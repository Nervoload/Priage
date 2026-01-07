// backend/src/modules/encounters/encounters.controller.ts
// encounters.controller.ts

// Written by: John Surette
// Date Created: Dec 8 2025
// Last Edited: Jan 6 2026

// REST API for encounters and related objects.

// Prototype endpoints

// - POST   /encounters                     create encounter (patient intake)
// - GET    /encounters                     list encounters (optional filters)
// - GET    /encounters/:id                 get encounter + related objects
// - PATCH  /encounters/:id/status          update status
// - POST   /encounters/:id/triage-notes    add triage note
// - POST   /encounters/:id/messages        post message

import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { EncounterStatus } from '@prisma/client';

import { EncountersService } from './encounters.service';
import { AddTriageNoteDto } from './dto/add-triage-note.dto';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListEncountersQueryDto } from './dto/list-encounters.query.dto';
import { UpdateEncounterStatusDto } from './dto/update-encounter-status.dto';

@Controller('encounters')
export class EncountersController {
  constructor(private readonly encountersService: EncountersService) {}

  @Post()
  async create(@Body() dto: CreateEncounterDto) {
    return this.encountersService.createEncounter(dto);
  }

  @Get()
  async list(@Query() query: ListEncountersQueryDto) {
    return this.encountersService.listEncounters(query);
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    return this.encountersService.getEncounter(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEncounterStatusDto,
  ) {
    return this.encountersService.updateEncounterStatus(id, dto.status as EncounterStatus);
  }

  @Post(':id/triage-notes')
  async addTriageNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddTriageNoteDto,
  ) {
    return this.encountersService.addTriageNote(id, dto.note);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.encountersService.addMessage(id, dto.from, dto.content);
  }
}
