// backend/src/modules/patients/patients.controller.ts
// Patient profile endpoints.

import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // Phase 6.3: Add a GET /patients list endpoint with query params for server-side
  // search and filtering. Suggested signature:
  //   @Get()
  //   async findAll(
  //     @Query('search') search?: string,       // name / phone / MRN substring
  //     @Query('status') status?: string,        // filter by encounter status
  //     @Query('page') page?: number,
  //     @Query('limit') limit?: number,
  //     @CurrentUser() user: { hospitalId },
  //   )
  // The service method should build Prisma WHERE clauses with `contains` / `startsWith`
  // and return paginated results. The frontend would call this via a new
  // searchPatients() function in shared/api/ and render results in a search modal.

  @Get(':id')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async getPatient(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.patientsService.getPatient(id, user.hospitalId, req.correlationId);
  }
}
