import { Body, Controller, Get, Header, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PublishClinicQuestionnaireDto } from '../dto/clinic-questionnaire.dto';
import { ClinicQuestionnaireService } from './clinic-questionnaire.service';

type Staff = { userId: number; hospitalId: number; role: Role };
// Clinical content, so IT admins can't change it.
const QUESTIONNAIRE_ROLES = [Role.ADMIN, Role.CLINICAL_ADMIN];

@Controller('clinic-questionnaire')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicQuestionnaireController {
  constructor(private readonly questionnaire: ClinicQuestionnaireService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Roles(...QUESTIONNAIRE_ROLES)
  view(@CurrentUser() staff: Staff) { return this.questionnaire.adminView(staff); }

  @Put()
  @Roles(...QUESTIONNAIRE_ROLES)
  publish(@CurrentUser() staff: Staff, @Body() dto: PublishClinicQuestionnaireDto) { return this.questionnaire.publish(staff, dto); }
}
