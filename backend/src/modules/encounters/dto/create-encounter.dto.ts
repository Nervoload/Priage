// backend/src/modules/encounters/dto/create-encounter.dto.ts
// Dec 8th, 2025
// made by John Surette
// Prisma-Postgres DB encounter management

export class CreateEncounterDto {
  hospitalId: number;
  patientDisplayName: string;
  patientPhone?: string;
  chiefComplaint: string;
  details?: string;
}
