import { AssetContext, AssetStatus, Prisma } from '@prisma/client';

export interface AssetSummaryDto {
  id: number;
  context: AssetContext;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  contentPath: string;
  messageId: number | null;
  encounterId: number | null;
}

export const assetSummarySelect = {
  id: true,
  context: true,
  status: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  createdAt: true,
  updatedAt: true,
  messageId: true,
  encounterId: true,
} satisfies Prisma.AssetSelect;

type AssetSummaryRecord = Prisma.AssetGetPayload<{ select: typeof assetSummarySelect }>;

export function mapAssetSummary(
  asset: AssetSummaryRecord,
  audience: 'patient' | 'staff',
): AssetSummaryDto {
  if (asset.status === AssetStatus.DELETED) {
    throw new Error(`Deleted asset ${asset.id} should not be serialized`);
  }

  return {
    id: asset.id,
    context: asset.context,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt,
    contentPath: audience === 'patient'
      ? `/patient/assets/${asset.id}/content`
      : `/assets/${asset.id}/content`,
    messageId: asset.messageId,
    encounterId: asset.encounterId,
  };
}
