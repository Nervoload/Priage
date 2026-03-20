#!/usr/bin/env node

require('dotenv').config();

const bcrypt = require('bcrypt');
const { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { dirname, join, resolve } = require('path');
const { createInterface } = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { PrismaClient, Role } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const projectRoot = resolve(__dirname, '..', '..');
const runtimeDir = process.env.PRIAGE_DEV_RUNTIME_DIR || join(projectRoot, '.priage-dev');
const manifestPath = join(runtimeDir, 'accounts.json');
const connectionString =
  process.env.DATABASE_URL || 'postgresql://priage:priage@localhost:5432/priage';
const argv = new Set(process.argv.slice(2));
const wantsExtraUser = argv.has('--create-extra-user') || argv.has('-u');

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_HOSPITAL_CONFIG = {
  triageReassessmentMinutes: 30,
  features: {
    messaging: true,
    alerts: true,
  },
};

const ROLE_OPTIONS = [Role.ADMIN, Role.NURSE, Role.DOCTOR, Role.STAFF];
const isInteractive = Boolean(input.isTTY && output.isTTY);

main()
  .catch((error) => {
    console.error(`\n[dev-bootstrap] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  });

async function main() {
  mkdirSync(runtimeDir, { recursive: true });

  const prompt = createPrompter();
  try {
    const existingAdmins = await listAdmins();
    const manifest = readManifest();
    const validManifestAdmin = await resolveManifestAdmin(manifest);

    if (!validManifestAdmin && existingAdmins.length === 0 && !isInteractive) {
      throw new Error(
        'No admin account exists and this shell is not interactive. Run ./priage-dev manually once to create a private local admin.',
      );
    }

    if (!validManifestAdmin && existingAdmins.length > 0 && !isInteractive) {
      throw new Error(
        'A database admin exists but .priage-dev/accounts.json is missing or stale. Re-run ./priage-dev interactively to register the admin credentials locally.',
      );
    }

    let nextManifest = manifest;
    let adminEntry = validManifestAdmin?.entry ?? null;

    if (!adminEntry) {
      if (existingAdmins.length === 0) {
        console.log('[dev-bootstrap] No admin account found. Creating a private dev admin.');
        adminEntry = await createAdminFlow(prompt);
      } else {
        adminEntry = await repairAdminFlow(prompt, existingAdmins);
      }

      nextManifest = mergeManifest(nextManifest, adminEntry, null);
      writeManifest(nextManifest);
      console.log(
        `[dev-bootstrap] Registered admin ${adminEntry.email} for ${adminEntry.hospitalSlug}.`,
      );
    } else {
      nextManifest = mergeManifest(nextManifest, adminEntry, null);
      writeManifest(nextManifest);
      console.log(
        `[dev-bootstrap] Using local admin ${adminEntry.email} for ${adminEntry.hospitalSlug}.`,
      );
    }

    if (wantsExtraUser) {
      if (!isInteractive) {
        throw new Error('Cannot create another hospital user in a non-interactive shell.');
      }

      const account = await createHospitalUserFlow(prompt);
      nextManifest = mergeManifest(nextManifest, adminEntry, account);
      writeManifest(nextManifest);
      console.log(
        `[dev-bootstrap] Added ${account.role} user ${account.email} for ${account.hospitalSlug}.`,
      );
    }

    const finalManifest = readManifest();
    const lastAccount = finalManifest.accounts.at(-1) ?? null;
    console.log('[dev-bootstrap] Local account manifest ready.');
    console.log(`  admin: ${finalManifest.admin.email} (${finalManifest.admin.hospitalSlug})`);
    if (lastAccount) {
      console.log(`  last user: ${lastAccount.email} (${lastAccount.role})`);
    }
  } finally {
    prompt.close();
  }
}

function createPrompter() {
  const rl = createInterface({ input, output });

  async function ask(question, options = {}) {
    const {
      defaultValue = '',
      allowEmpty = false,
      validate = null,
    } = options;

    while (true) {
      const suffix = defaultValue ? ` [${defaultValue}]` : '';
      const raw = await rl.question(`${question}${suffix}: `);
      const value = raw.trim() || defaultValue;

      if (!value && !allowEmpty) {
        console.log('A value is required.');
        continue;
      }

      if (validate) {
        const error = validate(value);
        if (error) {
          console.log(error);
          continue;
        }
      }

      return value;
    }
  }

  async function askYesNo(question, defaultValue = false) {
    const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
    while (true) {
      const raw = (await rl.question(`${question}${suffix}: `)).trim().toLowerCase();
      if (!raw) {
        return defaultValue;
      }
      if (raw === 'y' || raw === 'yes') {
        return true;
      }
      if (raw === 'n' || raw === 'no') {
        return false;
      }
      console.log('Enter yes or no.');
    }
  }

  async function select(question, options, formatter = (option) => String(option)) {
    if (options.length === 0) {
      throw new Error(`No options available for ${question}`);
    }

    console.log(question);
    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${formatter(option)}`);
    });

    while (true) {
      const raw = (await rl.question('Choose an option by number: ')).trim();
      const index = Number.parseInt(raw, 10);
      if (Number.isInteger(index) && index >= 1 && index <= options.length) {
        return options[index - 1];
      }
      console.log(`Enter a number between 1 and ${options.length}.`);
    }
  }

  async function askPassword(question) {
    if (!input.isTTY) {
      return ask(question);
    }

    while (true) {
      const value = await hiddenQuestion(`${question}: `);
      if (value.trim()) {
        return value.trim();
      }
      console.log('A password is required.');
    }
  }

  function close() {
    rl.close();
  }

  return {
    ask,
    askYesNo,
    askPassword,
    close,
    select,
  };
}

function hiddenQuestion(question) {
  return new Promise((resolve, reject) => {
    let value = '';

    output.write(question);
    input.resume();
    input.setRawMode(true);

    function cleanup() {
      input.setRawMode(false);
      input.removeListener('data', handleData);
    }

    function handleData(chunk) {
      const key = chunk.toString('utf8');

      if (key === '\u0003') {
        cleanup();
        output.write('\n');
        reject(new Error('Prompt cancelled.'));
        return;
      }

      if (key === '\r' || key === '\n') {
        cleanup();
        output.write('\n');
        resolve(value);
        return;
      }

      if (key === '\u007f') {
        if (value.length > 0) {
          value = value.slice(0, -1);
          output.write('\b \b');
        }
        return;
      }

      value += key;
      output.write('*');
    }

    input.on('data', handleData);
  });
}

async function createAdminFlow(prompt) {
  const hospital = await chooseHospitalForAdmin(prompt);
  const email = await prompt.ask('Admin email', { validate: validateEmail });
  const password = await prompt.askPassword('Admin password');
  const user = await createUser({
    email,
    password,
    role: Role.ADMIN,
    hospitalId: hospital.id,
  });

  return buildAccountEntry(user, hospital, password);
}

async function repairAdminFlow(prompt, admins) {
  const action = await prompt.select(
    'The local admin manifest is missing or stale. Choose how to recover it:',
    ['register-existing', 'create-new'],
    (option) => (
      option === 'register-existing'
        ? 'Register an existing admin into the local manifest'
        : 'Create a new admin account'
    ),
  );

  if (action === 'register-existing') {
    const selectedAdmin = await prompt.select(
      'Select the admin account to register locally:',
      admins,
      (admin) => `${admin.email} (${admin.hospital.name} / ${admin.hospital.slug})`,
    );

    while (true) {
      const password = await prompt.askPassword(`Password for ${selectedAdmin.email}`);
      const valid = await bcrypt.compare(password, selectedAdmin.password);
      if (!valid) {
        console.log('That password does not match the selected admin account.');
        continue;
      }
      return buildAccountEntry(selectedAdmin, selectedAdmin.hospital, password);
    }
  }

  return createAdminFlow(prompt);
}

async function createHospitalUserFlow(prompt) {
  const hospitals = await listHospitals();
  if (hospitals.length === 0) {
    throw new Error('Cannot create a hospital user because no hospitals exist.');
  }

  const hospital = await prompt.select(
    'Select the existing hospital for the new user:',
    hospitals,
    (entry) => `${entry.name} (${entry.slug})`,
  );
  const role = await prompt.select('Choose the user role:', ROLE_OPTIONS, (entry) => entry);
  const email = await prompt.ask('User email', { validate: validateEmail });
  const password = await prompt.askPassword('User password');
  const user = await createUser({
    email,
    password,
    role,
    hospitalId: hospital.id,
  });

  return buildAccountEntry(user, hospital, password);
}

async function chooseHospitalForAdmin(prompt) {
  const hospitals = await listHospitals();
  if (hospitals.length === 0) {
    return createHospital(prompt);
  }

  const choice = await prompt.select(
    'Choose the admin hospital:',
    [...hospitals, { id: null, name: 'Create new hospital', slug: '__create__' }],
    (entry) => (
      entry.id == null ? 'Create new hospital' : `${entry.name} (${entry.slug})`
    ),
  );

  if (choice.id == null) {
    return createHospital(prompt);
  }

  return choice;
}

async function createHospital(prompt) {
  const name = await prompt.ask('Hospital name');
  const defaultSlug = slugify(name);
  const slug = await prompt.ask('Hospital slug', {
    defaultValue: defaultSlug,
    validate: validateSlug,
  });

  try {
    return await prisma.hospital.create({
      data: {
        name,
        slug,
        config: {
          create: {
            config: DEFAULT_HOSPITAL_CONFIG,
          },
        },
      },
    });
  } catch (error) {
    throw new Error(formatPrismaError(error, `Could not create hospital ${slug}`));
  }
}

async function createUser({ email, password, role, hospitalId }) {
  try {
    return await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 10),
        role,
        hospitalId,
      },
    });
  } catch (error) {
    throw new Error(formatPrismaError(error, `Could not create ${role} user ${email}`));
  }
}

async function listAdmins() {
  return prisma.user.findMany({
    where: { role: Role.ADMIN },
    include: {
      hospital: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [
      { hospitalId: 'asc' },
      { email: 'asc' },
    ],
  });
}

async function listHospitals() {
  return prisma.hospital.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: { name: 'asc' },
  });
}

async function resolveManifestAdmin(manifest) {
  if (!manifest?.admin?.email || !manifest.admin.password) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: manifest.admin.email },
    include: {
      hospital: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!user || user.role !== Role.ADMIN) {
    return null;
  }

  const validPassword = await bcrypt.compare(manifest.admin.password, user.password);
  if (!validPassword) {
    return null;
  }

  return {
    entry: buildAccountEntry(user, user.hospital, manifest.admin.password),
  };
}

function buildAccountEntry(user, hospital, password) {
  return {
    email: user.email,
    password,
    role: user.role,
    userId: user.id,
    hospitalId: hospital.id,
    hospitalSlug: hospital.slug,
    createdAt: new Date().toISOString(),
  };
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    return {
      admin: null,
      accounts: [],
      updatedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return {
      admin: parsed.admin ?? null,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return {
      admin: null,
      accounts: [],
      updatedAt: null,
    };
  }
}

function writeManifest(manifest) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  chmodSync(manifestPath, 0o600);
}

function mergeManifest(manifest, adminEntry, createdAccount) {
  const accounts = Array.isArray(manifest.accounts) ? [...manifest.accounts] : [];
  if (createdAccount) {
    accounts.push(createdAccount);
  }

  return {
    admin: adminEntry,
    accounts,
    updatedAt: new Date().toISOString(),
  };
}

function validateEmail(value) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return 'Enter a valid email address.';
  }
  return null;
}

function validateSlug(value) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return 'Use lowercase letters, numbers, and single dashes only.';
  }
  return null;
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'hospital';
}

function formatPrismaError(error, fallback) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : 'unique field';
      return `${fallback}: ${target} already exists.`;
    }
  }
  return fallback;
}
