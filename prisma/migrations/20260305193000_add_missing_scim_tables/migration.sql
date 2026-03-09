-- Add missing SCIM tables expected by Prisma client.
CREATE TABLE IF NOT EXISTS "UserScimGroup" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "display" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserScimGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserProvisioningEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'SCIM',
  "requestId" TEXT,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserProvisioningEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserScimGroup_userId_value_key"
ON "UserScimGroup"("userId", "value");

CREATE INDEX IF NOT EXISTS "UserProvisioningEvent_userId_idx"
ON "UserProvisioningEvent"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserScimGroup_userId_fkey'
  ) THEN
    ALTER TABLE "UserScimGroup"
      ADD CONSTRAINT "UserScimGroup_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserProvisioningEvent_userId_fkey'
  ) THEN
    ALTER TABLE "UserProvisioningEvent"
      ADD CONSTRAINT "UserProvisioningEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
