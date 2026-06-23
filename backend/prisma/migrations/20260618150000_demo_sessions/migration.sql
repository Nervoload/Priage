-- CreateTable
CREATE TABLE "DemoSession" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "role" TEXT,
    "organizationType" TEXT,
    "interest" TEXT,
    "profileId" TEXT NOT NULL DEFAULT 'default-hospital-demo',
    "codeHash" TEXT NOT NULL,
    "accessTokenHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "DemoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoSession_accessTokenHash_key" ON "DemoSession"("accessTokenHash");

-- CreateIndex
CREATE INDEX "DemoSession_email_createdAt_idx" ON "DemoSession"("email", "createdAt");

-- CreateIndex
CREATE INDEX "DemoSession_profileId_idx" ON "DemoSession"("profileId");

-- CreateIndex
CREATE INDEX "DemoSession_status_expiresAt_idx" ON "DemoSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "DemoSession_expiresAt_idx" ON "DemoSession"("expiresAt");

-- CreateIndex
CREATE INDEX "DemoSession_revokedAt_idx" ON "DemoSession"("revokedAt");

-- CreateIndex
CREATE INDEX "DemoEvent_sessionId_createdAt_idx" ON "DemoEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "DemoEvent_type_createdAt_idx" ON "DemoEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "DemoEvent_createdAt_idx" ON "DemoEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "DemoEvent"
ADD CONSTRAINT "DemoEvent_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "DemoSession"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
