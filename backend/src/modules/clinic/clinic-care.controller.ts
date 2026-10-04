import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClinicCareService } from './clinic-care.service';
import { CareCopyAuditDto, CareFeedbackDto, ClearCareFeedbackDto, CreateCareCommentDto, CreateCareQuestionDto, FinishCareDto, SaveCareNoteDto, StartCareDto, UpdateCareCommentDto, UpdateCareQuestionDto } from './dto/clinic-care.dto';

type Staff = { userId: number; hospitalId: number; role: Role };
const READ_ROLES = [Role.DOCTOR, Role.CLINICAL_ADMIN, Role.NURSE, Role.ADMIN];
const WRITE_ROLES = [Role.DOCTOR, Role.CLINICAL_ADMIN];

@Controller('clinic-care')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClinicCareController {
  constructor(private readonly care: ClinicCareService) {}

  @Get('queue')
  @Header('Cache-Control', 'no-store')
  @Roles(...READ_ROLES)
  queue(@CurrentUser() staff: Staff) { return this.care.queue(staff); }

  @Get('encounters/:id')
  @Header('Cache-Control', 'no-store')
  @Roles(...READ_ROLES)
  state(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.care.state(staff, id); }

  @Get('encounters/:id/export')
  @Header('Cache-Control', 'no-store')
  @Roles(...READ_ROLES)
  exportText(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number) { return this.care.exportText(staff, id); }

  @Post('encounters/:id/copy-audit')
  @Roles(...READ_ROLES)
  copyAudit(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: CareCopyAuditDto) { return this.care.copyAudit(staff, id, dto); }

  @Post('encounters/:id/start')
  @Roles(...WRITE_ROLES)
  start(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: StartCareDto) { return this.care.start(staff, id, dto); }

  @Post('encounters/:id/finish')
  @Roles(...WRITE_ROLES)
  finish(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: FinishCareDto) { return this.care.finish(staff, id, dto); }

  @Put('encounters/:id/note')
  @Roles(...WRITE_ROLES)
  saveNote(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: SaveCareNoteDto) { return this.care.saveNote(staff, id, dto); }

  @Post('encounters/:id/comments')
  @Roles(...WRITE_ROLES)
  addComment(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateCareCommentDto) { return this.care.addComment(staff, id, dto); }

  @Patch('encounters/:id/comments/:commentId')
  @Roles(...WRITE_ROLES)
  updateComment(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Param('commentId', ParseIntPipe) commentId: number, @Body() dto: UpdateCareCommentDto) { return this.care.updateComment(staff, id, commentId, dto); }

  @Post('encounters/:id/open-questions')
  @Roles(...WRITE_ROLES)
  addOpenQuestion(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: CreateCareQuestionDto) { return this.care.addOpenQuestion(staff, id, dto); }

  @Put('encounters/:id/feedback')
  @Roles(...WRITE_ROLES)
  setFeedback(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Body() dto: CareFeedbackDto) { return this.care.setFeedback(staff, id, dto); }

  @Delete('encounters/:id/feedback')
  @Roles(...WRITE_ROLES)
  clearFeedback(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Query() dto: ClearCareFeedbackDto) { return this.care.clearFeedback(staff, id, dto); }

  @Patch('encounters/:id/open-questions/:questionId')
  @Roles(...WRITE_ROLES)
  updateOpenQuestion(@CurrentUser() staff: Staff, @Param('id', ParseIntPipe) id: number, @Param('questionId', ParseIntPipe) questionId: number, @Body() dto: UpdateCareQuestionDto) { return this.care.updateOpenQuestion(staff, id, questionId, dto); }
}
