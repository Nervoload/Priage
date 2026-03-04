// Priage AI service.
// Rule-based symptom assessment chatbot.
// Guides patients through structured questions, provides preliminary assessment,
// and can initiate hospital check-in via the intake flow.
// Designed to be swapped with an LLM-based implementation later.

import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EncounterStatus, EventType } from '@prisma/client';

import { EventsService } from '../events/events.service';
import { LoggingService } from '../logging/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { PriageChatDto, PriageAdmitDto } from './dto/chat.dto';

interface ChatResponse {
  reply: string;
  stage: string;
  assessment?: {
    urgency: 'low' | 'medium' | 'high' | 'emergency';
    suggestedAction: string;
    summary: string;
  };
  canAdmit: boolean;
}

// Simple keyword-based severity detection
const EMERGENCY_KEYWORDS = ['chest pain', 'can\'t breathe', 'unconscious', 'seizure', 'stroke', 'heart attack', 'severe bleeding', 'choking'];
const HIGH_KEYWORDS = ['broken', 'fracture', 'high fever', 'vomiting blood', 'head injury', 'allergic reaction', 'difficulty breathing', 'severe pain'];
const MEDIUM_KEYWORDS = ['fever', 'vomiting', 'dizziness', 'sprain', 'burn', 'cut', 'infection', 'pain', 'swelling'];

@Injectable()
export class PriageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly loggingService: LoggingService,
  ) {}

  /**
   * Process a conversation and return the next AI response.
   * Uses simple state detection based on conversation length and content.
   */
  async chat(patientId: number, dto: PriageChatDto, correlationId?: string): Promise<ChatResponse> {
    this.loggingService.info('Priage chat interaction', {
      service: 'PriageService',
      operation: 'chat',
      correlationId,
      patientId,
    }, { messageCount: dto.messages.length });

    const userMessages = dto.messages.filter(m => m.role === 'user');
    const msgCount = userMessages.length;
    const lastMsg = userMessages[userMessages.length - 1]?.content?.toLowerCase() ?? '';
    const allUserText = userMessages.map(m => m.content.toLowerCase()).join(' ');

    // Stage 0: First message — greeting
    if (msgCount === 0) {
      return {
        reply: `Hello! I'm Priage, your AI health assistant. I'm here to help assess your symptoms and connect you with the right care.\n\nWhat symptoms are you experiencing today?`,
        stage: 'greeting',
        canAdmit: false,
      };
    }

    // Stage 1: Got symptoms — ask about duration
    if (msgCount === 1) {
      return {
        reply: `Thank you for sharing that. How long have you been experiencing these symptoms? (e.g., "a few hours", "2 days", "a week")`,
        stage: 'duration',
        canAdmit: false,
      };
    }

    // Stage 2: Got duration — ask about severity
    if (msgCount === 2) {
      return {
        reply: `On a scale of 1 to 10, how would you rate the severity of your symptoms? (1 = very mild, 10 = worst pain/discomfort ever)`,
        stage: 'severity',
        canAdmit: false,
      };
    }

    // Stage 3: Got severity — ask about additional info
    if (msgCount === 3) {
      return {
        reply: `Are you experiencing any of the following?\n• Fever or chills\n• Nausea or vomiting\n• Difficulty breathing\n• Dizziness or lightheadedness\n• Any allergies to medications\n\nPlease describe any additional symptoms or concerns.`,
        stage: 'additional',
        canAdmit: false,
      };
    }

    // Stage 4+: Provide assessment
    const urgency = this.detectUrgency(allUserText, lastMsg);
    const symptoms = userMessages[0]?.content ?? 'your symptoms';
    const assessment = this.buildAssessment(urgency, symptoms);

    return {
      reply: assessment.message,
      stage: 'assessment',
      assessment: {
        urgency,
        suggestedAction: assessment.action,
        summary: assessment.summary,
      },
      canAdmit: true,
    };
  }

  /**
   * Create an encounter (hospital admission) from a Priage assessment.
   */
  async admit(
    patientId: number,
    sessionId: number,
    dto: PriageAdmitDto,
    correlationId?: string,
  ) {
    this.loggingService.info('Priage admission request', {
      service: 'PriageService',
      operation: 'admit',
      correlationId,
      patientId,
    }, { chiefComplaint: dto.chiefComplaint, hospitalSlug: dto.hospitalSlug });

    // Resolve hospital
    let hospitalId: number;
    if (dto.hospitalSlug) {
      const hospital = await this.prisma.hospital.findUnique({
        where: { slug: dto.hospitalSlug },
        select: { id: true },
      });
      if (!hospital) throw new NotFoundException('Hospital not found');
      hospitalId = hospital.id;
    } else {
      // Default to first hospital if none specified
      const hospital = await this.prisma.hospital.findFirst({
        select: { id: true },
      });
      if (!hospital) throw new NotFoundException('No hospitals available');
      hospitalId = hospital.id;
    }

    // Create encounter in a transaction
    const { encounter, event } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.encounter.create({
        data: {
          patientId,
          hospitalId,
          status: EncounterStatus.EXPECTED,
          chiefComplaint: dto.chiefComplaint,
          details: dto.details,
          expectedAt: new Date(),
        },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              age: true,
            },
          },
        },
      });

      // Link session to encounter
      await tx.patientSession.update({
        where: { id: sessionId },
        data: { encounterId: created.id },
      });

      const createdEvent = await this.events.emitEncounterEventTx(tx, {
        encounterId: created.id,
        hospitalId,
        type: EventType.ENCOUNTER_CREATED,
        metadata: {
          status: created.status,
          source: 'priage_ai',
          severity: dto.severity,
        },
        actor: { actorPatientId: patientId },
      });

      return { encounter: created, event: createdEvent };
    });

    void this.events.dispatchEncounterEventAndMarkProcessed(event);

    return {
      encounter,
      message: 'You have been checked in. The hospital has been notified and you can track your status from the dashboard.',
    };
  }

  /**
   * List available hospitals for patient to choose.
   */
  async listHospitals() {
    return this.prisma.hospital.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
  }

  private detectUrgency(allText: string, lastMsg: string): 'low' | 'medium' | 'high' | 'emergency' {
    if (EMERGENCY_KEYWORDS.some(k => allText.includes(k))) return 'emergency';
    if (HIGH_KEYWORDS.some(k => allText.includes(k))) return 'high';
    if (MEDIUM_KEYWORDS.some(k => allText.includes(k))) return 'medium';

    // Check severity number
    const severityMatch = lastMsg.match(/\b([7-9]|10)\b/);
    if (severityMatch) return 'high';
    const medMatch = lastMsg.match(/\b([4-6])\b/);
    if (medMatch) return 'medium';

    return 'low';
  }

  private buildAssessment(urgency: string, symptoms: string) {
    switch (urgency) {
      case 'emergency':
        return {
          message: `⚠️ **URGENT**: Based on your symptoms, this appears to be a potentially serious situation that requires immediate medical attention.\n\n**My recommendation**: Please proceed to the nearest emergency room immediately, or call 911 if you are unable to get there safely.\n\nWould you like me to check you into the nearest hospital now?`,
          action: 'Seek immediate emergency care',
          summary: `Patient reports symptoms consistent with an emergency situation: ${symptoms}`,
        };
      case 'high':
        return {
          message: `Based on your description, your symptoms suggest you should see a medical professional soon — ideally within the next few hours.\n\n**My recommendation**: I'd suggest visiting an emergency room or urgent care center today.\n\nWould you like me to check you into a hospital? I can get you in the queue so you spend less time waiting.`,
          action: 'Visit ER or urgent care within hours',
          summary: `Patient reports symptoms requiring prompt medical attention: ${symptoms}`,
        };
      case 'medium':
        return {
          message: `Your symptoms don't appear to be immediately life-threatening, but they do warrant medical attention.\n\n**My recommendation**: Consider visiting an urgent care or scheduling a same-day appointment with your doctor. If symptoms worsen, please seek emergency care.\n\nWould you like me to check you into a hospital to be seen today?`,
          action: 'Visit urgent care or doctor today',
          summary: `Patient reports moderate symptoms: ${symptoms}`,
        };
      default:
        return {
          message: `Based on what you've described, your symptoms appear to be mild. Here are some suggestions:\n\n• Rest and stay hydrated\n• Monitor your symptoms over the next 24-48 hours\n• Take over-the-counter medication as appropriate\n\nIf your symptoms worsen or don't improve, don't hesitate to seek medical care.\n\nWould you still like me to check you into a hospital?`,
          action: 'Monitor at home; see doctor if worsening',
          summary: `Patient reports mild symptoms: ${symptoms}`,
        };
    }
  }
}
