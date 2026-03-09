import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PartnerCredentialStatus } from '@prisma/client';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

export type PlatformPartnerContext = {
  partnerId: number;
  partnerSlug: string;
  partnerName: string;
  credentialId: number;
  hospitalId: number;
  scopes: string[];
  trustPolicy: {
    defaultTrustTier: 'UNTRUSTED' | 'PARTNER_SUBMITTED' | 'INSTITUTION_TRUSTED';
    defaultVisibilityScope: 'STORED_ONLY' | 'ADMISSIONS' | 'TRIAGE' | 'CLINICAL';
    requirePatientConfirmation: boolean;
    allowPreConfirmOperationalUse: boolean;
  };
};

@Injectable()
export class PlatformAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateApiKey(rawKey: string): Promise<PlatformPartnerContext> {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const credential = await this.prisma.partnerCredential.findUnique({
      where: { keyHash },
      include: {
        partner: true,
        trustPolicy: true,
      },
    });

    if (!credential || credential.status !== PartnerCredentialStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid partner API key');
    }

    return {
      partnerId: credential.partnerId,
      partnerSlug: credential.partner.slug,
      partnerName: credential.partner.name,
      credentialId: credential.id,
      hospitalId: credential.hospitalId,
      scopes: credential.scopes,
      trustPolicy: {
        defaultTrustTier: credential.trustPolicy?.defaultTrustTier ?? 'PARTNER_SUBMITTED',
        defaultVisibilityScope: credential.trustPolicy?.defaultVisibilityScope ?? 'STORED_ONLY',
        requirePatientConfirmation: credential.trustPolicy?.requirePatientConfirmation ?? true,
        allowPreConfirmOperationalUse: credential.trustPolicy?.allowPreConfirmOperationalUse ?? false,
      },
    };
  }
}
