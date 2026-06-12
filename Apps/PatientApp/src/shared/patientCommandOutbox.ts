import { API_BASE_URL, ApiError } from './api/client';

const DB_NAME = 'priage-patient-outbox';
const STORE_NAME = 'commands';
const DB_VERSION = 1;
const MAX_ATTEMPTS = 30;

type StoredFile = {
  field: string;
  name: string;
  type: string;
  blob: Blob;
};

type PatientCommand = {
  id: string;
  endpoint: string;
  method: string;
  body: unknown | null;
  files: StoredFile[];
  createdAt: string;
  attempts: number;
  nextAttemptAt: number;
};

export class PatientCommandQueuedError extends Error {
  constructor(public readonly commandId: string) {
    super('Your update is saved on this device and will retry when connectivity returns');
    this.name = 'PatientCommandQueuedError';
  }
}

export async function sendDurablePatientCommand<T>(
  endpoint: string,
  method: string,
  body: unknown,
): Promise<T> {
  const command = createCommand(endpoint, method, body, []);
  await putCommand(command);
  return sendStoredCommand<T>(command);
}

export async function sendDurablePatientUpload<T>(
  endpoint: string,
  files: Array<{ field?: string; file: File }>,
): Promise<T> {
  const command = createCommand(
    endpoint,
    'POST',
    null,
    files.map(({ field = 'files', file }) => ({
      field,
      name: file.name,
      type: file.type,
      blob: file,
    })),
  );
  await putCommand(command);
  return sendStoredCommand<T>(command);
}

export async function flushPatientCommandOutbox(): Promise<void> {
  const commands = (await listCommands())
    .filter((command) => command.nextAttemptAt <= Date.now() && command.attempts < MAX_ATTEMPTS)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  for (const command of commands) {
    await sendStoredCommand(command).catch(() => undefined);
  }
}

function createCommand(endpoint: string, method: string, body: unknown | null, files: StoredFile[]): PatientCommand {
  return {
    id: `patient-command:${crypto.randomUUID()}`,
    endpoint,
    method,
    body,
    files,
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
}

async function sendStoredCommand<T>(command: PatientCommand): Promise<T> {
  try {
    const multipart = command.files.length > 0;
    const body = multipart ? buildFormData(command.files) : JSON.stringify(command.body);
    const response = await fetch(`${API_BASE_URL}${command.endpoint}`, {
      method: command.method,
      credentials: 'include',
      headers: {
        ...(multipart ? {} : { 'Content-Type': 'application/json' }),
        'Idempotency-Key': command.id,
      },
      body,
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      const error = new ApiError(response.status, text, command.endpoint);
      if (!isRetryable(error)) {
        await deleteCommand(command.id);
      } else {
        await reschedule(command);
      }
      throw error;
    }
    await deleteCommand(command.id);
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    if (error instanceof ApiError && !isRetryable(error)) {
      throw error;
    }
    if (!(error instanceof ApiError)) {
      await reschedule(command);
    }
    throw new PatientCommandQueuedError(command.id);
  }
}

function buildFormData(files: StoredFile[]): FormData {
  const form = new FormData();
  for (const file of files) {
    form.append(file.field, file.blob, file.name);
  }
  return form;
}

function isRetryable(error: ApiError): boolean {
  return error.status === 408 || error.status === 409 || error.status === 425 || error.status === 429 || error.status >= 500;
}

async function reschedule(command: PatientCommand): Promise<void> {
  const attempts = command.attempts + 1;
  await putCommand({
    ...command,
    attempts,
    nextAttemptAt: Date.now() + Math.min(5 * 60_000, 2 ** Math.min(attempts, 8) * 1000),
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putCommand(command: PatientCommand): Promise<void> {
  const db = await openDb();
  await transactionPromise(db, 'readwrite', (store) => store.put(command));
}

async function deleteCommand(id: string): Promise<void> {
  const db = await openDb();
  await transactionPromise(db, 'readwrite', (store) => store.delete(id));
}

async function listCommands(): Promise<PatientCommand[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PatientCommand[]);
    request.onerror = () => reject(request.error);
  });
}

function transactionPromise(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    action(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
