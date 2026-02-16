// backend/src/modules/messaging/messaging.controller.ts
// Messaging endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages.query.dto';
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
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.messagingService.listMessages(encounterId, user.hospitalId, query, req.correlationId);
  }

  // Phase 6.2: This REST endpoint will remain as a fallback, but the primary
  // send path should move to the WebSocket gateway (@SubscribeMessage('message.send'))
  // for lower-latency staff chat. The messaging.ts API client on the frontend
  // already wraps this endpoint but isn't wired into ChatPanel yet.
  @Post('encounters/:encounterId/messages')
  @Roles(Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Body() dto: CreateMessageDto,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.messagingService.createMessage(
      encounterId,
      user.hospitalId,
      user.userId,
      dto,
      req.correlationId,
    );
  }

  @Post('messages/:messageId/read')
  @Roles(Role.STAFF, Role.NURSE, Role.DOCTOR, Role.ADMIN)
  async markRead(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Req() req: Request,
    @CurrentUser() user: { userId: number; hospitalId: number },
  ) {
    return this.messagingService.markMessageRead(messageId, user.hospitalId, user.userId, req.correlationId);
  }
}
