import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AssetAccessMode, AssetStorageProvider } from '@prisma/client';
import {
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, rename, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';

import { ASSET_ALLOWED_MIME_TYPES } from './assets.constants';

type StorageProviderConfig =
  | {
      provider: 'LOCAL';
      root: string;
      accessMode: 'PROXY';
      retentionDays: number | null;
    }
  | {
      provider: 'S3';
      bucket: string;
      region: string;
      endpoint?: string;
      forcePathStyle: boolean;
      accessMode: AssetAccessMode;
      signedUrlTtlSeconds: number;
      retentionDays: number | null;
      encryption: ServerSideEncryption;
      kmsKeyId: string | null;
    };

export type StoredAsset = {
  storageKey: string;
  sha256: string;
  storageProvider: AssetStorageProvider;
  storageBucket: string | null;
  storageRegion: string | null;
  storageEndpoint: string | null;
  accessMode: AssetAccessMode;
  retainedUntil: Date | null;
  encryption: string | null;
};

@Injectable()
export class AssetStorageService {
  private readonly config = this.loadConfig();
  private readonly s3 = this.createS3Client();

  async saveImage(
    buffer: Buffer,
    options: { bucket: 'intake' | 'messages'; mimeType: string },
  ): Promise<StoredAsset> {
    const extension = ASSET_ALLOWED_MIME_TYPES.get(options.mimeType);
    if (!extension) throw new Error(`Unsupported image mime type: ${options.mimeType}`);
    const now = new Date();
    const storageKey = path.posix.join(
      'quarantine',
      options.bucket,
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${extension}`,
    );
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    if (this.config.provider === 'S3') {
      await this.sendS3(new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: options.mimeType,
        ChecksumSHA256: Buffer.from(sha256, 'hex').toString('base64'),
        ServerSideEncryption: this.config.encryption,
        SSEKMSKeyId: this.config.kmsKeyId || undefined,
        Metadata: { scanStatus: 'NOT_SCANNED', sha256 },
      }), 'upload');
    } else {
      const absolutePath = path.join(this.config.root, storageKey);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, buffer);
    }

    return {
      storageKey,
      sha256,
      storageProvider: this.config.provider,
      storageBucket: this.config.provider === 'S3' ? this.config.bucket : null,
      storageRegion: this.config.provider === 'S3' ? this.config.region : null,
      storageEndpoint: this.config.provider === 'S3' ? this.config.endpoint ?? null : null,
      accessMode: this.config.accessMode,
      retainedUntil: this.buildRetentionDate(),
      encryption: this.config.provider === 'S3'
        ? this.config.kmsKeyId ? `${this.config.encryption}:${this.config.kmsKeyId}` : this.config.encryption
        : null,
    };
  }

  async openReadStream(storageKey: string): Promise<Readable> {
    if (this.config.provider === 'LOCAL') {
      return createReadStream(path.join(this.config.root, storageKey));
    }
    const response = await this.sendS3(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: storageKey }),
      'read',
    );
    if (!response.Body) throw new ServiceUnavailableException('Object storage returned an empty asset');
    return response.Body as Readable;
  }

  async createSignedReadUrl(storageKey: string): Promise<string | null> {
    if (this.config.provider !== 'S3' || !this.s3) return null;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: storageKey,
        ResponseCacheControl: 'private, no-store',
      }),
      { expiresIn: this.config.signedUrlTtlSeconds },
    );
  }

  async delete(storageKey: string): Promise<void> {
    if (this.config.provider === 'LOCAL') {
      await unlink(path.join(this.config.root, storageKey)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
      return;
    }
    await this.sendS3(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: storageKey }), 'delete');
  }

  async promoteFromQuarantine(storageKey: string): Promise<string> {
    if (!storageKey.startsWith('quarantine/')) return storageKey;
    const promotedKey = storageKey.replace(/^quarantine\//, 'clean/');
    if (this.config.provider === 'LOCAL') {
      const source = path.join(this.config.root, storageKey);
      const target = path.join(this.config.root, promotedKey);
      await mkdir(path.dirname(target), { recursive: true });
      await rename(source, target);
      return promotedKey;
    }

    const copySource = `${this.config.bucket}/${storageKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`;
    await this.sendS3(new CopyObjectCommand({
      Bucket: this.config.bucket,
      Key: promotedKey,
      CopySource: copySource,
      ServerSideEncryption: this.config.encryption,
      SSEKMSKeyId: this.config.kmsKeyId || undefined,
      MetadataDirective: 'COPY',
    }), 'promote');
    await this.delete(storageKey);
    return promotedKey;
  }

  isProductionObjectStorage(): boolean {
    return this.config.provider === 'S3';
  }

  private createS3Client(): S3Client | null {
    if (this.config.provider !== 'S3') return null;
    return new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
    });
  }

  private async sendS3(command: any, action: string): Promise<any> {
    if (!this.s3) throw new ServiceUnavailableException('S3 storage is not configured');
    try {
      return await this.s3.send(command);
    } catch (error) {
      throw new ServiceUnavailableException(
        `Object storage ${action} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private loadConfig(): StorageProviderConfig {
    const provider = (process.env.ASSET_STORAGE_PROVIDER || 'local').trim().toLowerCase();
    const retentionDays = this.parsePositiveInteger(process.env.ASSET_RETENTION_DAYS) ?? null;
    if (provider === 's3') {
      const kmsKeyId = process.env.ASSET_S3_KMS_KEY_ID?.trim() || null;
      if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && !kmsKeyId) {
        throw new Error('ASSET_S3_KMS_KEY_ID is required for production object storage');
      }
      return {
        provider: 'S3',
        bucket: this.requireEnv('ASSET_STORAGE_BUCKET'),
        region: process.env.ASSET_STORAGE_REGION?.trim() || 'us-east-1',
        endpoint: process.env.ASSET_STORAGE_ENDPOINT?.trim() || undefined,
        forcePathStyle: this.parseBooleanEnv(
          process.env.ASSET_STORAGE_FORCE_PATH_STYLE,
          Boolean(process.env.ASSET_STORAGE_ENDPOINT),
        ),
        accessMode: this.resolveAccessMode(process.env.ASSET_ACCESS_MODE, 'SIGNED_URL'),
        signedUrlTtlSeconds: this.parsePositiveInteger(process.env.ASSET_SIGNED_URL_TTL_SECONDS) ?? 300,
        retentionDays,
        encryption: kmsKeyId ? 'aws:kms' : 'AES256',
        kmsKeyId,
      };
    }
    if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
      throw new Error('ASSET_STORAGE_PROVIDER=s3 is required in production');
    }
    return {
      provider: 'LOCAL',
      root: process.env.ASSET_STORAGE_ROOT
        ? path.resolve(process.env.ASSET_STORAGE_ROOT)
        : path.resolve(process.cwd(), '.data/assets'),
      accessMode: 'PROXY',
      retentionDays,
    };
  }

  private resolveAccessMode(value: string | undefined, fallback: AssetAccessMode): AssetAccessMode {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'proxy') return 'PROXY';
    if (normalized === 'signed-url' || normalized === 'signed_url') return 'SIGNED_URL';
    return fallback;
  }

  private buildRetentionDate(): Date | null {
    return this.config.retentionDays
      ? new Date(Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000)
      : null;
  }

  private requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required when ASSET_STORAGE_PROVIDER=s3`);
    return value;
  }

  private parsePositiveInteger(value: string | undefined): number | null {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
    if (!value) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
}
