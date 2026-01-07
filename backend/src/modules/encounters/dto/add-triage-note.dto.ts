// backend/src/modules/encounters/dto/add-triage-note.dto.ts
// add-triage-note.dto.ts

// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026

// DTO for adding a triage note to an encounter.

import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddTriageNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  note!: string;
}
