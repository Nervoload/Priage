// backend/src/modules/messaging/messaging.controller.ts
// Messaging endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages.query.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('encounters/:encounterId/messages')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async listForEncounter(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messagingService.listMessages(encounterId, query);
  }

  @Post('encounters/:encounterId/messages')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagingService.createMessage(encounterId, dto);
  }

  @Post('messages/:messageId/read')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async markRead(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: MarkMessageReadDto,
  ) {
    return this.messagingService.markMessageRead(messageId, dto.actorUserId);
  }
}
