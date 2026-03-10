CREATE TABLE IF NOT EXISTS "UarSettings" (
  "id" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL DEFAULT 'default',
  "systemReviewPeriodDays" INTEGER NOT NULL DEFAULT 365,
  "srReviewPeriodDays" INTEGER NOT NULL DEFAULT 180,
  "brReviewPeriodDays" INTEGER NOT NULL DEFAULT 180,
  "directAccessReviewPeriodDays" INTEGER NOT NULL DEFAULT 90,
  "reviewLookbackDays" INTEGER NOT NULL DEFAULT 30,
  "reviewWarningWindowDays" INTEGER NOT NULL DEFAULT 30,
  "overdueGraceDays" INTEGER NOT NULL DEFAULT 0,
  "notifyOwnersBeforeDays" INTEGER NOT NULL DEFAULT 15,
  "autoRevokeOnOverdue" BOOLEAN NOT NULL DEFAULT true,
  "requireJustificationOnRenewal" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UarSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UarSettings_tenantKey_key"
ON "UarSettings"("tenantKey");
