CREATE TABLE "user_role_assignments" (
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("user_id","role")
);

CREATE INDEX "user_role_assignments_role_idx" ON "user_role_assignments"("role");

ALTER TABLE "user_role_assignments"
ADD CONSTRAINT "user_role_assignments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_role_assignments" ("user_id", "role", "created_at", "updated_at")
SELECT u.id, 'USER'::"UserRole", now(), now()
FROM "User" u
ON CONFLICT ("user_id", "role") DO NOTHING;

INSERT INTO "user_role_assignments" ("user_id", "role", "created_at", "updated_at")
SELECT u.id, u.role, now(), now()
FROM "User" u
WHERE u.role IN ('MANAGER'::"UserRole", 'ADMIN'::"UserRole")
ON CONFLICT ("user_id", "role") DO NOTHING;

INSERT INTO "user_role_assignments" ("user_id", "role", "created_at", "updated_at")
SELECT DISTINCT m.id, 'MANAGER'::"UserRole", now(), now()
FROM "User" m
WHERE EXISTS (
  SELECT 1
  FROM "User" r
  WHERE r."managerId" = m.id
    AND r.active = true
)
ON CONFLICT ("user_id", "role") DO NOTHING;

UPDATE "User" u
SET
  role = CASE
    WHEN EXISTS (
      SELECT 1 FROM "user_role_assignments" ura
      WHERE ura."user_id" = u.id AND ura.role = 'ADMIN'::"UserRole"
    ) THEN 'ADMIN'::"UserRole"
    WHEN EXISTS (
      SELECT 1 FROM "user_role_assignments" ura
      WHERE ura."user_id" = u.id AND ura.role = 'MANAGER'::"UserRole"
    ) THEN 'MANAGER'::"UserRole"
    ELSE 'USER'::"UserRole"
  END,
  "updatedAt" = now();
