-- Add owner references to runtime authorization models
ALTER TABLE "System" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Permission" ADD COLUMN "ownerId" TEXT;

-- Add owner attributes to orchestrator System Role mirror
ALTER TABLE "system_roles" ADD COLUMN "owner" TEXT;
ALTER TABLE "system_roles" ADD COLUMN "owner_id" TEXT;

CREATE INDEX "System_ownerId_idx" ON "System"("ownerId");
CREATE INDEX "Permission_ownerId_idx" ON "Permission"("ownerId");
CREATE INDEX "system_roles_owner_id_idx" ON "system_roles"("owner_id");

ALTER TABLE "System"
  ADD CONSTRAINT "System_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
