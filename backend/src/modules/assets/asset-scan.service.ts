import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class AssetScanService {
  async scan(buffer: Buffer, mimeType: string): Promise<{ clean: boolean; detail: string }> {
    const scannerUrl = process.env.ASSET_SCANNER_URL?.trim();
    if (!scannerUrl) {
      if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
        throw new ServiceUnavailableException('ASSET_SCANNER_URL is required in production');
      }
      return { clean: true, detail: 'development scanner bypass' };
    }

    const response = await fetch(scannerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'x-scan-api-key': process.env.ASSET_SCANNER_API_KEY || '',
      },
      body: buffer,
      signal: AbortSignal.timeout(Number.parseInt(process.env.ASSET_SCANNER_TIMEOUT_MS || '15000', 10)),
    }).catch((error) => {
      throw new ServiceUnavailableException(`Asset scanner unavailable: ${error instanceof Error ? error.message : String(error)}`);
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(`Asset scanner failed with status ${response.status}`);
    }
    const result = await response.json() as { clean?: boolean; detail?: string };
    return {
      clean: result.clean === true,
      detail: String(result.detail || (result.clean ? 'clean' : 'rejected')).slice(0, 1000),
    };
  }
}

