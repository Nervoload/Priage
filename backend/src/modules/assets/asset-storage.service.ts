import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AssetAccessMode, AssetStorageProvider } from '@prisma/client';
import { createHash, createHmac, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
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
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle: boolean;
      accessMode: AssetAccessMode;
      signedUrlTtlSeconds: number;
      retentionDays: number | null;
      encryption: string | null;
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

  async saveImage(
    buffer: Buffer,
    options: { bucket: 'intake' | 'messages'; mimeType: string },
  ): Promise<StoredAsset> {
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
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    if (this.config.provider === 'S3') {
      await this.putS3Object(storageKey, buffer, options.mimeType, sha256);
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
      storageEndpoint: this.config.provider === 'S3' ? this.config.endpoint : null,
      accessMode: this.config.accessMode,
      retainedUntil: this.buildRetentionDate(),
      encryption: this.config.provider === 'S3' ? this.config.encryption : null,
    };
  }

  async openReadStream(storageKey: string): Promise<Readable> {
    if (this.config.provider === 'LOCAL') {
      return createReadStream(path.join(this.config.root, storageKey));
    }

    const response = await fetch(this.createPresignedS3Url('GET', storageKey));
    if (!response.ok || !response.body) {
      throw new ServiceUnavailableException(`Unable to read asset from object storage (${response.status})`);
    }

    return Readable.fromWeb(response.body as any);
  }

  async createSignedReadUrl(storageKey: string): Promise<string | null> {
    if (this.config.provider !== 'S3') {
      return null;
    }

    return this.createPresignedS3Url('GET', storageKey);
  }

  async delete(storageKey: string): Promise<void> {
    if (this.config.provider === 'LOCAL') {
      const absolutePath = path.join(this.config.root, storageKey);
      await unlink(absolutePath).catch(() => undefined);
      return;
    }

    await fetch(this.buildS3ObjectUrl(storageKey), {
      method: 'DELETE',
      headers: this.buildS3AuthorizationHeaders('DELETE', storageKey, Buffer.alloc(0), {}),
    }).catch(() => undefined);
  }

  private async putS3Object(
    storageKey: string,
    buffer: Buffer,
    mimeType: string,
    sha256: string,
  ): Promise<void> {
    if (this.config.provider !== 'S3') {
      return;
    }

    const extraHeaders: Record<string, string> = {
      'content-type': mimeType,
    };

    if (this.config.encryption) {
      extraHeaders['x-amz-server-side-encryption'] = this.config.encryption;
    }

    const response = await fetch(this.buildS3ObjectUrl(storageKey), {
      method: 'PUT',
      headers: this.buildS3AuthorizationHeaders('PUT', storageKey, buffer, extraHeaders, sha256),
      body: buffer,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ServiceUnavailableException(`Object storage upload failed (${response.status}): ${body}`);
    }
  }

  private loadConfig(): StorageProviderConfig {
    const provider = (process.env.ASSET_STORAGE_PROVIDER || 'local').trim().toLowerCase();
    const retentionDays = this.parsePositiveInteger(process.env.ASSET_RETENTION_DAYS) ?? null;

    if (provider === 's3') {
      const bucket = this.requireEnv('ASSET_STORAGE_BUCKET');
      const region = process.env.ASSET_STORAGE_REGION?.trim() || 'us-east-1';
      const endpoint = process.env.ASSET_STORAGE_ENDPOINT?.trim()
        || `https://s3.${region}.amazonaws.com`;
      const accessKeyId = this.requireEnv('ASSET_STORAGE_ACCESS_KEY_ID');
      const secretAccessKey = this.requireEnv('ASSET_STORAGE_SECRET_ACCESS_KEY');
      const forcePathStyle = this.parseBooleanEnv(
        process.env.ASSET_STORAGE_FORCE_PATH_STYLE,
        Boolean(process.env.ASSET_STORAGE_ENDPOINT),
      );

      return {
        provider: 'S3',
        bucket,
        region,
        endpoint: endpoint.replace(/\/+$/, ''),
        accessKeyId,
        secretAccessKey,
        forcePathStyle,
        accessMode: this.resolveAccessMode(process.env.ASSET_ACCESS_MODE, 'SIGNED_URL'),
        signedUrlTtlSeconds: this.parsePositiveInteger(process.env.ASSET_SIGNED_URL_TTL_SECONDS) ?? 300,
        retentionDays,
        encryption: process.env.ASSET_S3_SERVER_SIDE_ENCRYPTION?.trim() || null,
      };
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
    if (normalized === 'proxy') {
      return 'PROXY';
    }
    if (normalized === 'signed-url' || normalized === 'signed_url') {
      return 'SIGNED_URL';
    }
    return fallback;
  }

  private buildRetentionDate(): Date | null {
    const retentionDays = this.config.retentionDays;
    if (!retentionDays) {
      return null;
    }

    return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
  }

  private buildS3ObjectUrl(storageKey: string): string {
    if (this.config.provider !== 'S3') {
      throw new Error('S3 storage is not configured');
    }

    const encodedKey = storageKey.split('/').map(encodeURIComponent).join('/');
    if (this.config.forcePathStyle) {
      return `${this.config.endpoint}/${this.config.bucket}/${encodedKey}`;
    }

    const endpoint = new URL(this.config.endpoint);
    endpoint.hostname = `${this.config.bucket}.${endpoint.hostname}`;
    endpoint.pathname = `/${encodedKey}`;
    return endpoint.toString();
  }

  private buildS3AuthorizationHeaders(
    method: 'PUT' | 'DELETE',
    storageKey: string,
    body: Buffer,
    extraHeaders: Record<string, string>,
    precomputedSha256?: string,
  ): Record<string, string> {
    if (this.config.provider !== 'S3') {
      throw new Error('S3 storage is not configured');
    }

    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = precomputedSha256 ?? createHash('sha256').update(body).digest('hex');
    const objectUrl = new URL(this.buildS3ObjectUrl(storageKey));
    const headers: Record<string, string> = {
      host: objectUrl.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders,
    };
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((key) => `${key}:${headers[key].trim()}\n`)
      .join('');
    const canonicalRequest = [
      method,
      objectUrl.pathname,
      objectUrl.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signature = this.signString(stringToSign, dateStamp);

    return {
      ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [this.canonicalHeaderName(key), value])),
      Authorization: [
        `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${signature}`,
      ].join(', '),
    };
  }

  private createPresignedS3Url(method: 'GET', storageKey: string): string {
    if (this.config.provider !== 'S3') {
      throw new Error('S3 storage is not configured');
    }

    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const objectUrl = new URL(this.buildS3ObjectUrl(storageKey));
    objectUrl.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    objectUrl.searchParams.set('X-Amz-Credential', `${this.config.accessKeyId}/${credentialScope}`);
    objectUrl.searchParams.set('X-Amz-Date', amzDate);
    objectUrl.searchParams.set('X-Amz-Expires', String(this.config.signedUrlTtlSeconds));
    objectUrl.searchParams.set('X-Amz-SignedHeaders', 'host');

    const canonicalQuery = Array.from(objectUrl.searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    const canonicalRequest = [
      method,
      objectUrl.pathname,
      canonicalQuery,
      `host:${objectUrl.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    objectUrl.searchParams.set('X-Amz-Signature', this.signString(stringToSign, dateStamp));

    return objectUrl.toString();
  }

  private signString(value: string, dateStamp: string): string {
    if (this.config.provider !== 'S3') {
      throw new Error('S3 storage is not configured');
    }

    const dateKey = createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
    const dateRegionKey = createHmac('sha256', dateKey).update(this.config.region).digest();
    const dateRegionServiceKey = createHmac('sha256', dateRegionKey).update('s3').digest();
    const signingKey = createHmac('sha256', dateRegionServiceKey).update('aws4_request').digest();
    return createHmac('sha256', signingKey).update(value).digest('hex');
  }

  private formatAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  private canonicalHeaderName(value: string): string {
    return value
      .split('-')
      .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
      .join('-');
  }

  private requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required when ASSET_STORAGE_PROVIDER=s3`);
    }
    return value;
  }

  private parsePositiveInteger(value: string | undefined): number | null {
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
    if (!value) {
      return fallback;
    }

    switch (value.trim().toLowerCase()) {
      case '1':
      case 'true':
      case 'yes':
      case 'on':
        return true;
      case '0':
      case 'false':
      case 'no':
      case 'off':
        return false;
      default:
        return fallback;
    }
  }
}
