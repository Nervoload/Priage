import type {
  AiTriageGenerationInput,
  AiTriageProviderName,
  AiTriageProviderResult,
} from '../types/ai-triage.types';

export interface AiTriageProvider {
  readonly name: Exclude<AiTriageProviderName, 'fallback'>;
  isConfigured(): boolean;
  generateNextStep(input: AiTriageGenerationInput): Promise<AiTriageProviderResult | null>;
}
