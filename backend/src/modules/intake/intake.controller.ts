// backend/src/modules/intake/intake.controller.ts
// Patient intake endpoints.

import { Body, Controller, Headers, Patch, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

import { ConfirmIntentDto } from './dto/confirm-intent.dto';
import { CreateIntentDto } from './dto/create-intent.dto';
import { LocationPingDto } from './dto/location-ping.dto';
import { UpdateIntakeDetailsDto } from './dto/update-intake-details.dto';
import { IntakeService } from './intake.service';

@Controller('intake')
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post('intent')
  async createIntent(@Body() dto: CreateIntentDto, @Req() req: Request) {
    return this.intakeService.createIntent(dto, req.correlationId);
  }

  @Post('confirm')
  async confirmIntent(
    @Headers('x-patient-token') token: string,
    @Body() dto: ConfirmIntentDto,
    @Req() req: Request,
  ) {
    if (!token) {
      throw new UnauthorizedException('Patient token is required');
    }
    return this.intakeService.confirmIntent(token, dto, req.correlationId);
  }

  @Patch('details')
  async updateDetails(
    @Headers('x-patient-token') token: string,
    @Body() dto: UpdateIntakeDetailsDto,
    @Req() req: Request,
  ) {
    if (!token) {
      throw new UnauthorizedException('Patient token is required');
    }
    return this.intakeService.updateDetails(token, dto, req.correlationId);
  }

  @Post('location')
  async recordLocation(
    @Headers('x-patient-token') token: string,
    @Body() dto: LocationPingDto,
    @Req() req: Request,
  ) {
    if (!token) {
      throw new UnauthorizedException('Patient token is required');
    }
    return this.intakeService.recordLocation(token, dto, req.correlationId);
  }
}
