// backend/src/modules/encounters/encounters.controller.ts
// encounters.controller.ts

// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026

// REST API for encounters and related objects.

// Prototype endpoints

// - POST   /encounters                     create encounter
// - GET    /encounters                     list encounters (optional filters)
// - GET    /encounters/:id                 get encounter + related objects
// - POST   /encounters/:id/confirm          confirm encounter
// - POST   /encounters/:id/arrived          mark arrived
// - POST   /encounters/:id/waiting          mark waiting
// - POST   /encounters/:id/start-exam       start exam/triage
// - POST   /encounters/:id/discharge        discharge encounter
// - POST   /encounters/:id/cancel           cancel encounter

import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { EncounterActorDto } from './dto/encounter-actor.dto';
import { ListEncountersQueryDto } from './dto/list-encounters.query.dto';

@Controller('encounters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async create(@Body() dto: CreateEncounterDto) {
    return this.encountersService.createEncounter(dto);
  }

  @Get()
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async list(@Query() query: ListEncountersQueryDto) {
    return this.encountersService.listEncounters(query);
  }

  @Get(':id')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.encountersService.getEncounter(id);
  }

  @Post(':id/confirm')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncounterActorDto,
  ) {
    return this.encountersService.confirm(id, dto);
  }

  @Post(':id/arrived')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async markArrived(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncounterActorDto,
  ) {
    return this.encountersService.markArrived(id, dto);
  }

  @Post(':id/waiting')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async createWaiting(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncounterActorDto,
  ) {
    return this.encountersService.createWaiting(id, dto);
  }

  @Post(':id/start-exam')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async startExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncounterActorDto,
  ) {
    return this.encountersService.startExam(id, dto);
  }

  @Post(':id/discharge')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async discharge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncounterActorDto,
  ) {
    return this.encountersService.discharge(id, dto);
  }

  @Post(':id/cancel')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EncounterActorDto,
  ) {
    return this.encountersService.cancel(id, dto);
  }
}
