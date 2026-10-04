import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LegalDocumentKind, Prisma } from '@prisma/client';

export interface RecordVisitAcceptanceInput {
  intakeSessionId: number;
  patientId: number;
  encounterId: number;
  termsDocumentId: number;
  privacyDocumentId: number;
  accepted: boolean;
}

@Injectable()
export class LegalDocumentsService {
  /**
   * Call inside the transaction that submits a clinic appointment request.
   * Public entry remains gated until approved documents are published.
   */
  async recordAcceptanceTx(tx: Prisma.TransactionClient, input: RecordVisitAcceptanceInput) {
    if (input.accepted !== true) {
      throw new BadRequestException('Terms and privacy acceptance must be affirmative');
    }

    const session = await tx.intakeSession.findUnique({
      where: { id: input.intakeSessionId },
      select: { patientId: true, encounterId: true },
    });
    if (!session || session.patientId !== input.patientId || session.encounterId !== input.encounterId) {
      throw new NotFoundException('Intake session is not linked to this patient and encounter');
    }

    const prior = await tx.visitAcceptance.findUnique({ where: { intakeSessionId: input.intakeSessionId } });
    if (prior) {
      this.assertSameAcceptance(prior, input);
      return prior;
    }

    const [terms, privacy] = await Promise.all([
      this.currentPublishedTx(tx, LegalDocumentKind.TERMS),
      this.currentPublishedTx(tx, LegalDocumentKind.PRIVACY),
    ]);
    if (!terms || !privacy || terms.id !== input.termsDocumentId || privacy.id !== input.privacyDocumentId) {
      throw new ConflictException('Legal documents have changed or are not published');
    }

    // ON CONFLICT DO NOTHING handles concurrent retries without attempting an
    // UPDATE against the immutable acceptance table.
    await tx.visitAcceptance.createMany({
      data: [{
        intakeSessionId: input.intakeSessionId,
        patientId: input.patientId,
        encounterId: input.encounterId,
        termsDocumentId: terms.id,
        privacyDocumentId: privacy.id,
      }],
      skipDuplicates: true,
    });

    const acceptance = await tx.visitAcceptance.findUnique({
      where: { intakeSessionId: input.intakeSessionId },
    });
    if (!acceptance) {
      throw new ConflictException('A different acceptance already exists for this visit');
    }
    this.assertSameAcceptance(acceptance, input);
    return acceptance;
  }

  private assertSameAcceptance(
    acceptance: { patientId: number; encounterId: number | null; termsDocumentId: number; privacyDocumentId: number },
    input: RecordVisitAcceptanceInput,
  ) {
    if (acceptance.patientId !== input.patientId
      || acceptance.encounterId !== input.encounterId
      || acceptance.termsDocumentId !== input.termsDocumentId
      || acceptance.privacyDocumentId !== input.privacyDocumentId) {
      throw new ConflictException('A different acceptance already exists for this intake');
    }
  }

  private currentPublishedTx(tx: Prisma.TransactionClient, kind: LegalDocumentKind) {
    return tx.legalDocumentVersion.findFirst({
      where: { kind, publishedAt: { lte: new Date() } },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
  }
}
