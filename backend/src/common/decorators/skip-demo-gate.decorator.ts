// backend/src/common/decorators/skip-demo-gate.decorator.ts
// Marks a route handler or controller so the DemoAccessGuard skips it.

import { SetMetadata } from '@nestjs/common';

export const SKIP_DEMO_GATE_KEY = 'skipDemoGate';
export const SkipDemoGate = () => SetMetadata(SKIP_DEMO_GATE_KEY, true);
