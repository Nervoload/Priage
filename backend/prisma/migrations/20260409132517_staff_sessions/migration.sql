-- CreateTable
CREATE TABLE "StaffSession" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdIp" TEXT,
    "createdUserAgent" TEXT,
    "lastSeenIp" TEXT,
    "lastSeenUserAgent" TEXT,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffSession_token_key" ON "StaffSession"("token");

-- CreateIndex
CREATE INDEX "StaffSession_userId_createdAt_idx" ON "StaffSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- CreateIndex
CREATE INDEX "StaffSession_revokedAt_idx" ON "StaffSession"("revokedAt");

-- AddForeignKey
ALTER TABLE "StaffSession"
ADD CONSTRAINT "StaffSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
