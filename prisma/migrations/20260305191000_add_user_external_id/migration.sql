-- Align existing User table with Prisma schema field `externalId`.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "externalId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_externalId_key"
ON "User"("externalId");
