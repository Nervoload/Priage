// backend/src/modules/messaging/messaging.controller.ts
// Messaging endpoints.

import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';

import { CreateMessageDto } from './dto/create-message.dto';
import { MarkMessageReadDto } from './dto/mark-message-read.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('encounters/:encounterId/messages')
  async listForEncounter(@Param('encounterId', ParseIntPipe) encounterId: number) {
    return this.messagingService.listMessages(encounterId);
  }

  @Post('encounters/:encounterId/messages')
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagingService.createMessage(encounterId, dto);
  }

  @Post('messages/:messageId/read')
  async markRead(
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() dto: MarkMessageReadDto,
  ) {
    return this.messagingService.markMessageRead(messageId, dto.actorUserId);
  }
}
