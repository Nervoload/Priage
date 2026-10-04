import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

import { ClinicPilotService } from './clinic-pilot.service';

@Injectable()
export class LegacyIntakeGuard implements CanActivate {
  constructor(private readonly pilot: ClinicPilotService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.pilot.hospitalId) throw new NotFoundException();
    return true;
  }
}
