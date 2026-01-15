// backend/src/modules/assets/assets.service.ts
// Asset metadata service.

import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAsset(dto: CreateAssetDto) {
    const encounter = await this.prisma.encounter.findUnique({
      where: { id: dto.encounterId },
      select: { id: true, hospitalId: true },
    });
    if (!encounter || encounter.hospitalId !== dto.hospitalId) {
      throw new NotFoundException('Encounter does not belong to hospital');
    }

    const storageKey = dto.storageKey ?? `encounters/${dto.encounterId}/${randomUUID()}`;

    const asset = await this.prisma.asset.create({
      data: {
        encounterId: dto.encounterId,
        hospitalId: dto.hospitalId,
        storageKey,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        sha256: dto.sha256,
      },
    });

    return {
      asset,
      uploadUrl: `/assets/${asset.id}/upload`,
    };
  }

  async listAssets(encounterId: number) {
    return this.prisma.asset.findMany({
      where: { encounterId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
