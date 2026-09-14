// Patient-facing hospital directory.

import { Controller, Get } from '@nestjs/common';

import { PriageService } from './priage.service';

@Controller('patient/priage')
export class PriageController {
  constructor(private readonly priageService: PriageService) {}

  @Get('hospitals')
  async listHospitals() {
    return this.priageService.listHospitals();
  }
}
