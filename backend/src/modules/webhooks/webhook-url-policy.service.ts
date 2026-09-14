import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

@Injectable()
export class WebhookUrlPolicyService {
  async assertAllowed(rawUrl: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Webhook target must be a valid URL');
    }
    const production = (process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
    if ((production && url.protocol !== 'https:') || (!production && !['https:', 'http:'].includes(url.protocol))) {
      throw new BadRequestException('Webhook target must use HTTPS in production');
    }
    if (url.username || url.password) throw new BadRequestException('Webhook target cannot contain credentials');

    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const allowedHosts = new Set(
      (process.env.WEBHOOK_ALLOWED_HOSTS || '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    );
    if (production && !allowedHosts.has(hostname)) {
      throw new BadRequestException('Webhook target host is not allowlisted');
    }

    if (isIP(hostname) && this.isPrivateAddress(hostname)) {
      throw new BadRequestException('Webhook target cannot use a private or local address');
    }
    const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
    if (addresses.length === 0) throw new BadRequestException('Webhook target host could not be resolved');
    if (addresses.some((entry) => this.isPrivateAddress(entry.address))) {
      throw new BadRequestException('Webhook target resolves to a private or local address');
    }
    return url;
  }

  private isPrivateAddress(address: string): boolean {
    const normalized = address.toLowerCase();
    if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    const ipv4 = normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
    const parts = ipv4.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
    const [a, b] = parts;
    return a === 0
      || a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a >= 224;
  }
}
