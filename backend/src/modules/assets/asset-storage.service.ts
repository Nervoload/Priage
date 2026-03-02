import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

import { ASSET_ALLOWED_MIME_TYPES } from './assets.constants';

@Injectable()
export class AssetStorageService {
  private readonly root = process.env.ASSET_STORAGE_ROOT
    ? path.resolve(process.env.ASSET_STORAGE_ROOT)
    : path.resolve(process.cwd(), '.data/assets');

  async saveImage(
    buffer: Buffer,
    options: { bucket: 'intake' | 'messages'; mimeType: string },
  ): Promise<{ storageKey: string; sha256: string }> {
    const extension = ASSET_ALLOWED_MIME_TYPES.get(options.mimeType);
    if (!extension) {
      throw new Error(`Unsupported image mime type: ${options.mimeType}`);
    }

    const now = new Date();
    const storageKey = path.posix.join(
      options.bucket,
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${extension}`,
    );

    const absolutePath = path.join(this.root, storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storageKey,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  openReadStream(storageKey: string): Readable {
    return createReadStream(path.join(this.root, storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = path.join(this.root, storageKey);
    await unlink(absolutePath).catch(() => undefined);
  }
}
