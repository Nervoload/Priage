// backend/src/modules/realtime/realtime.module.ts
// realtime.module.ts
// Written by: John Surette
// Date Created: Jan 6 2026
// Last Edited: Jan 6 2026
// Realtime module: provides WebSocket gateway for encounter events and messaging.

import { Module } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway';

@Module({
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
