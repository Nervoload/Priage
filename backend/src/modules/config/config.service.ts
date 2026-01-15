import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StorageConfig {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKey?: string;
  secretKey?: string;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  getNodeEnv(): string {
    return this.configService.getOrThrow<string>('NODE_ENV');
  }

  getPort(): number {
    return this.configService.getOrThrow<number>('PORT');
  }

  getDatabaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }

  getRedisUrl(): string {
    return this.configService.getOrThrow<string>('REDIS_URL');
  }

  getJwtAccessSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  getJwtRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  getJwtAccessTtl(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_TTL');
  }

  getJwtRefreshTtl(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_TTL');
  }

  getStorageConfig(): StorageConfig {
    return {
      endpoint: this.configService.get<string>('STORAGE_ENDPOINT'),
      region: this.configService.get<string>('STORAGE_REGION'),
      bucket: this.configService.get<string>('STORAGE_BUCKET'),
      accessKey: this.configService.get<string>('STORAGE_ACCESS_KEY'),
      secretKey: this.configService.get<string>('STORAGE_SECRET_KEY'),
    };
  }
}
