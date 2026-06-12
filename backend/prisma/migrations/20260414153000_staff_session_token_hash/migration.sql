CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "StaffSession"
ADD COLUMN "tokenHash_tmp" TEXT;

UPDATE "StaffSession"
SET "tokenHash_tmp" = encode(digest("token", 'sha256'), 'hex');

DROP INDEX IF EXISTS "StaffSession_token_key";

ALTER TABLE "StaffSession"
DROP COLUMN "token";

ALTER TABLE "StaffSession"
RENAME COLUMN "tokenHash_tmp" TO "tokenHash";

ALTER TABLE "StaffSession"
ALTER COLUMN "tokenHash" SET NOT NULL;

CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");
