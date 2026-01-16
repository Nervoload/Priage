// backend/src/modules/intake/intake.controller.ts
// Patient intake endpoints.

import { Body, Controller, Headers, Patch, Post } from '@nestjs/common';

import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { UpdateIntakeDetailsDto } from './dto/update-intake-details.dto';
import { IntakeService } from './intake.service';

@Controller('intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post('intent')
  async createIntent(@Body() dto: CreateIntentDto) {
    return this.intakeService.createIntent(dto);
  }

  @Post('confirm')
  async confirmIntent(
    @Headers('x-patient-token') token: string,
    @Body() dto: ConfirmIntentDto,
  ) {
    return this.intakeService.confirmIntent(token, dto);
  }

  @Patch('details')
  async updateDetails(
    @Headers('x-patient-token') token: string,
    @Body() dto: UpdateIntakeDetailsDto,
  ) {
    return this.intakeService.updateDetails(token, dto);
  }

  @Post('location')
  async recordLocation(
    @Headers('x-patient-token') token: string,
    @Body() dto: LocationPingDto,
  ) {
    return this.intakeService.recordLocation(token, dto);
  }
}
