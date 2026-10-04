import { describe, expect, it, vi } from 'vitest';

import { LegalDocumentsService } from '../src/modules/legal/legal-documents.service';

function transaction() {
  const existing = { id: 1, intakeSessionId: 5, patientId: 8, encounterId: 12, termsDocumentId: 21, privacyDocumentId: 22 };
  return {
    intakeSession: { findUnique: vi.fn(async () => ({ patientId: 8, encounterId: 12 })) },
    legalDocumentVersion: {
      findFirst: vi.fn(async ({ where }) => where.kind === 'TERMS' ? { id: 21 } : { id: 22 }),
    },
    visitAcceptance: { createMany: vi.fn(), findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(existing) },
  };
}

const accepted = {
  intakeSessionId: 5,
  patientId: 8,
  encounterId: 12,
  termsDocumentId: 21,
  privacyDocumentId: 22,
  accepted: true,
};

describe('clinic visit legal acceptance', () => {
  const service = new LegalDocumentsService();

  it('requires an affirmative choice and linked intake', async () => {
    const tx = transaction();
    await expect(service.recordAcceptanceTx(tx as any, { ...accepted, accepted: false })).rejects.toThrow('affirmative');
    tx.intakeSession.findUnique.mockResolvedValue({ patientId: 9, encounterId: 12 });
    await expect(service.recordAcceptanceTx(tx as any, accepted)).rejects.toThrow('not linked');
    expect(tx.visitAcceptance.createMany).not.toHaveBeenCalled();
  });

  it('rejects unpublished or stale document IDs', async () => {
    const tx = transaction();
    tx.legalDocumentVersion.findFirst.mockResolvedValueOnce(null);
    await expect(service.recordAcceptanceTx(tx as any, accepted)).rejects.toThrow('not published');
    await expect(service.recordAcceptanceTx(transaction() as any, { ...accepted, termsDocumentId: 19 })).rejects.toThrow('changed');
  });

  it('records once and accepts only an identical retry', async () => {
    const tx = transaction();
    await service.recordAcceptanceTx(tx as any, accepted);
    expect(tx.visitAcceptance.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ termsDocumentId: 21, privacyDocumentId: 22 })],
      skipDuplicates: true,
    });
    tx.visitAcceptance.findUnique.mockResolvedValue({ id: 1, intakeSessionId: 5, patientId: 8, encounterId: 12, termsDocumentId: 21, privacyDocumentId: 22 });
    tx.legalDocumentVersion.findFirst.mockResolvedValue(null);
    await service.recordAcceptanceTx(tx as any, accepted);
    tx.visitAcceptance.findUnique.mockResolvedValue({ id: 1, intakeSessionId: 5, patientId: 8, encounterId: 12, termsDocumentId: 20, privacyDocumentId: 22 });
    await expect(service.recordAcceptanceTx(tx as any, accepted)).rejects.toThrow('different acceptance');
  });

  it('reports a conflicting acceptance linked to the encounter', async () => {
    const tx = transaction();
    tx.visitAcceptance.findUnique.mockResolvedValue(null);
    await expect(service.recordAcceptanceTx(tx as any, accepted)).rejects.toThrow('already exists for this visit');
  });
});
