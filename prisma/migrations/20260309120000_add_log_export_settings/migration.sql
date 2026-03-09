DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LogExportDestination') THEN
    CREATE TYPE "LogExportDestination" AS ENUM ('SPLUNK_HEC', 'AWS_S3');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LogExportSettings" (
  "id" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL DEFAULT 'default',
  "destination" "LogExportDestination" NOT NULL DEFAULT 'SPLUNK_HEC',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "splunkEndpoint" TEXT,
  "splunkTokenEnc" TEXT,
  "splunkIndex" TEXT,
  "splunkSource" TEXT,
  "splunkSourceType" TEXT,
  "s3Region" TEXT,
  "s3Bucket" TEXT,
  "s3Prefix" TEXT,
  "s3AccessKeyIdEnc" TEXT,
  "s3SecretAccessKeyEnc" TEXT,
  "s3SessionTokenEnc" TEXT,
  "lastExportAt" TIMESTAMP(3),
  "lastExportStatus" TEXT,
  "lastExportMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LogExportSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LogExportSettings_tenantKey_key" ON "LogExportSettings"("tenantKey");

