// backend/src/modules/auth/decorators/current-patient.decorator.ts
// Extract current patient context from request (set by PatientGuard).

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PatientContext } from '../guards/patient.guard';

export const CurrentPatient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PatientContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.patientUser;
  },
);
