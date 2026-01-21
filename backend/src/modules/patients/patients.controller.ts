// backend/src/modules/patients/patients.controller.ts
// Patient profile endpoints.

import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get(':id')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async getPatient(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getPatient(id, req.correlationId);
  }
}
