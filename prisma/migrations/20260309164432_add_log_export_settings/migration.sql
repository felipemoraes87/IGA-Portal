DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScimEnvironment') THEN
    CREATE TYPE "ScimEnvironment" AS ENUM ('production', 'staging', 'sandbox');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScimAuthType') THEN
    CREATE TYPE "ScimAuthType" AS ENUM ('bearer_token', 'oauth2', 'api_key');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScimUpdateMethod') THEN
    CREATE TYPE "ScimUpdateMethod" AS ENUM ('PATCH', 'PUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScimProvisioningMode') THEN
    CREATE TYPE "ScimProvisioningMode" AS ENUM ('real_time', 'batch');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScimGroupSourceOfTruth') THEN
    CREATE TYPE "ScimGroupSourceOfTruth" AS ENUM ('scim', 'local', 'hybrid');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScimSyncStrategy') THEN
    CREATE TYPE "ScimSyncStrategy" AS ENUM ('full', 'incremental');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ScimRetryBackoff') THEN
    CREATE TYPE "ScimRetryBackoff" AS ENUM ('fixed', 'exponential');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ScimSettings" (
  "id" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL DEFAULT 'default',
  "environment" "ScimEnvironment" NOT NULL,
  "scimBaseUrl" TEXT NOT NULL,
  "connectionStatus" TEXT NOT NULL DEFAULT 'unknown',
  "authType" "ScimAuthType" NOT NULL DEFAULT 'bearer_token',
  "bearerTokenEnc" TEXT,
  "oauthTokenUrl" TEXT,
  "oauthClientId" TEXT,
  "oauthClientSecretEnc" TEXT,
  "oauthScopes" JSONB,
  "apiKeyEnc" TEXT,
  "apiKeyHeader" TEXT,
  "tokenExpiration" INTEGER,
  "autoRotateToken" BOOLEAN NOT NULL DEFAULT false,
  "enableCreateUser" BOOLEAN NOT NULL DEFAULT true,
  "enableUpdateUser" BOOLEAN NOT NULL DEFAULT true,
  "updateMethod" "ScimUpdateMethod" NOT NULL DEFAULT 'PATCH',
  "enableDeactivateUser" BOOLEAN NOT NULL DEFAULT true,
  "enableDeleteUser" BOOLEAN NOT NULL DEFAULT false,
  "provisioningMode" "ScimProvisioningMode" NOT NULL DEFAULT 'real_time',
  "attributeMappings" JSONB,
  "enableGroupSync" BOOLEAN NOT NULL DEFAULT false,
  "groupSourceOfTruth" "ScimGroupSourceOfTruth" NOT NULL DEFAULT 'scim',
  "groupMappings" JSONB,
  "syncGroupMembership" BOOLEAN NOT NULL DEFAULT true,
  "syncStrategy" "ScimSyncStrategy" NOT NULL DEFAULT 'incremental',
  "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
  "retryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maxRetries" INTEGER NOT NULL DEFAULT 3,
  "retryBackoff" "ScimRetryBackoff" NOT NULL DEFAULT 'exponential',
  "ipAllowlist" JSONB,
  "rateLimitPerMinute" INTEGER,
  "mtlsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "auditEnabled" BOOLEAN NOT NULL DEFAULT true,
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "lastTestAt" TIMESTAMP(3),
  "lastTestStatus" TEXT,
  "lastTestMessage" TEXT,
  "lastSchemaValidationAt" TIMESTAMP(3),
  "lastSchemaValidationStatus" TEXT,
  "lastSchemaValidationMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScimSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScimSettings_tenantKey_environment_key"
ON "ScimSettings"("tenantKey", "environment");

DROP INDEX IF EXISTS "UserProvisioningEvent_userId_idx";
