// backend/src/modules/patients/patients.controller.ts
// Patient profile endpoints.

import { Controller, Get, Param, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListPatientsQueryDto } from './dto/list-patients.query.dto';
import { PatientsService } from './patients.service';

@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async findAll(
    @Req() req: Request,
    @Query() query: ListPatientsQueryDto,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.patientsService.listPatients(user.hospitalId, query, req.correlationId);
  }

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
