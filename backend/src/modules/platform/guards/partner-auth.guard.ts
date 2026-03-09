import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { PlatformAuthService } from '../platform-auth.service';

@Injectable()
export class PartnerAuthGuard implements CanActivate {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const headerKey = request.headers['x-partner-key'];
    const authHeader = request.headers.authorization;
    const apiKey = typeof headerKey === 'string' && headerKey.trim()
      ? headerKey.trim()
      : typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : null;

    if (!apiKey) {
      throw new UnauthorizedException('Partner API key is required');
    }

    request.partnerCredential = await this.platformAuthService.validateApiKey(apiKey);
    return true;
  }
}
