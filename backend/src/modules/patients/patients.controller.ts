// backend/src/modules/patients/patients.controller.ts
// Patient profile endpoints.

import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

import { PatientsService } from './patients.service';

@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get(':id')
  async getPatient(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getPatient(id);
  }
}
