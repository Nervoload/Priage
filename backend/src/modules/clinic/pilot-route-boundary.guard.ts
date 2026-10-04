import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { ClinicPilotService } from './clinic-pilot.service';

/** Deny first-party and partner ED intake commands on the dedicated clinic deployment. */
@Injectable()
export class PilotRouteBoundaryGuard implements CanActivate {
  constructor(private readonly pilot: ClinicPilotService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.pilot.hospitalId) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;
    if (
      path === '/intake' || path.startsWith('/intake/')
      || path === '/platform/v1/intake-sessions' || path.startsWith('/platform/v1/intake-sessions/')
      || path === '/triage' || path.startsWith('/triage/')
      || (request.method === 'POST' && (path === '/encounters' || path === '/encounters/admit'))
    ) throw new NotFoundException();
    return true;
  }
}
