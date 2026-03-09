BEGIN;

WITH users_src AS (
  SELECT
    id,
    email,
    name,
    manager_id,
    status,
    updated_at,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn
  FROM users
  WHERE lower(coalesce(is_current, 'false')) = 'true'
),
users_pick AS (
  SELECT
    id,
    COALESCE(NULLIF(lower(btrim(email)), ''), lower(id) || '@orchestrator.local') AS base_email,
    COALESCE(NULLIF(name, ''), id) AS full_name,
    manager_id,
    status
  FROM users_src
  WHERE rn = 1
),
users_email AS (
  SELECT
    id,
    CASE
      WHEN ROW_NUMBER() OVER (PARTITION BY base_email ORDER BY id) = 1 THEN base_email
      ELSE split_part(base_email, '@', 1) || '+' || lower(replace(id, ' ', '')) || '@' || COALESCE(NULLIF(split_part(base_email, '@', 2), ''), 'orchestrator.local')
    END AS final_email,
    full_name,
    manager_id,
    status
  FROM users_pick
),
users_email_resolved AS (
  SELECT
    ue.id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM "User" u
        WHERE lower(u.email) = lower(ue.final_email)
          AND u.id <> ue.id
      ) THEN lower(replace(ue.id, ' ', '')) || '@orchestrator.local'
      ELSE ue.final_email
    END AS final_email,
    ue.full_name,
    ue.manager_id,
    ue.status
  FROM users_email ue
)
INSERT INTO "User" (id, email, name, role, active, "createdAt", "updatedAt")
SELECT
  id,
  final_email,
  full_name,
  'USER'::"UserRole",
  CASE
    WHEN lower(coalesce(status, 'active')) IN ('active', 'ativo') THEN true
    ELSE false
  END,
  now(),
  now()
FROM users_email_resolved
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  "updatedAt" = now();

WITH users_src AS (
  SELECT
    id,
    manager_id,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn
  FROM users
  WHERE lower(coalesce(is_current, 'false')) = 'true'
)
UPDATE "User" u
SET
  "managerId" = us.manager_id,
  "updatedAt" = now()
FROM users_src us
WHERE us.rn = 1
  AND u.id = us.id
  AND us.manager_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM "User" m WHERE m.id = us.manager_id);

WITH sw_src AS (
  SELECT
    id,
    name,
    critical_system,
    org_owner_id,
    updated_at,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn
  FROM softwares
  WHERE lower(coalesce(is_current, 'true')) = 'true'
)
INSERT INTO "System" (id, name, criticality, "ownerId", "createdAt", "updatedAt")
SELECT
  sw.id,
  COALESCE(NULLIF(sw.name, ''), sw.id) || ' [' || sw.id || ']',
  CASE
    WHEN lower(coalesce(sw.critical_system, 'false')) IN ('true', '1', 'yes', 'sim') THEN 'HIGH'::"Criticality"
    ELSE 'MED'::"Criticality"
  END,
  u.id,
  now(),
  now()
FROM sw_src sw
LEFT JOIN "User" u ON u.id = sw.org_owner_id
WHERE sw.rn = 1
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  criticality = EXCLUDED.criticality,
  "ownerId" = EXCLUDED."ownerId",
  "updatedAt" = now();

WITH sr_src AS (
  SELECT
    id,
    software_id,
    technical_id,
    owner_id,
    name,
    description,
    origin,
    risk,
    updated_at,
    _row_id,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn_id
  FROM system_roles
  WHERE lower(coalesce(is_current, 'false')) = 'true'
),
sr_latest AS (
  SELECT
    id,
    software_id,
    owner_id,
    COALESCE(NULLIF(technical_id, ''), NULLIF(name, ''), id) AS permission_name,
    description,
    origin,
    risk,
    updated_at,
    _row_id
  FROM sr_src
  WHERE rn_id = 1
),
sr_dedup AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY software_id, permission_name ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn_sys_name
  FROM sr_latest
)
INSERT INTO "Permission" (id, "systemId", "ownerId", name, description, "createdAt", "updatedAt")
SELECT
  d.id,
  d.software_id,
  COALESCE(u.id, s."ownerId"),
  d.permission_name,
  COALESCE(
    NULLIF(d.description, ''),
    CASE
      WHEN d.origin IS NULL AND d.risk IS NULL THEN NULL
      ELSE 'origin=' || COALESCE(d.origin, '-') || '; risk=' || COALESCE(d.risk, '-')
    END
  ),
  now(),
  now()
FROM sr_dedup d
JOIN "System" s ON s.id = d.software_id
LEFT JOIN "User" u ON u.id = d.owner_id
WHERE d.rn_sys_name = 1
ON CONFLICT (id) DO UPDATE
SET
  "systemId" = EXCLUDED."systemId",
  "ownerId" = COALESCE(
    EXCLUDED."ownerId",
    (SELECT s."ownerId" FROM "System" s WHERE s.id = EXCLUDED."systemId")
  ),
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "updatedAt" = now();

WITH br_src AS (
  SELECT
    id,
    name,
    technical_id,
    updated_at,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn
  FROM business_roles
  WHERE lower(coalesce(is_current, 'false')) = 'true'
)
INSERT INTO "BusinessRole" (id, name, description, "createdAt", "updatedAt")
SELECT
  br.id,
  COALESCE(NULLIF(br.technical_id, ''), NULLIF(br.name, ''), br.id) || ' [' || br.id || ']',
  COALESCE(NULLIF(br.name, ''), br.technical_id),
  now(),
  now()
FROM br_src br
WHERE br.rn = 1
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  "updatedAt" = now();

WITH obr AS (
  SELECT DISTINCT user_id, br_id
  FROM snapshot_br_users_match
  WHERE user_id IS NOT NULL
    AND br_id IS NOT NULL
)
INSERT INTO "UserBusinessRole" (id, "userId", "businessRoleId", "createdAt")
SELECT
  md5(obr.user_id || ':' || obr.br_id),
  obr.user_id,
  obr.br_id,
  now()
FROM obr
JOIN "User" u ON u.id = obr.user_id
JOIN "BusinessRole" br ON br.id = obr.br_id
ON CONFLICT ("userId", "businessRoleId") DO NOTHING;

WITH sbr_src AS (
  SELECT
    business_role_id,
    system_role_id,
    updated_at,
    _row_id,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn
  FROM system_business_roles
  WHERE lower(coalesce(is_current, 'true')) = 'true'
)
INSERT INTO "BusinessRolePermission" (id, "businessRoleId", "permissionId")
SELECT
  md5(sbr.business_role_id || ':' || sbr.system_role_id),
  sbr.business_role_id,
  sbr.system_role_id
FROM sbr_src sbr
JOIN "BusinessRole" br ON br.id = sbr.business_role_id
JOIN "Permission" p ON p.id = sbr.system_role_id
WHERE sbr.rn = 1
ON CONFLICT ("businessRoleId", "permissionId") DO NOTHING;

WITH sr_src AS (
  SELECT
    id,
    technical_id,
    updated_at,
    _row_id,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn_id
  FROM system_roles
  WHERE lower(coalesce(is_current, 'false')) = 'true'
),
sr_latest AS (
  SELECT
    id,
    lower(COALESCE(NULLIF(technical_id, ''), id)) AS tech_norm,
    updated_at,
    _row_id
  FROM sr_src
  WHERE rn_id = 1
),
sr_map AS (
  SELECT
    id AS permission_id,
    tech_norm,
    ROW_NUMBER() OVER (PARTITION BY tech_norm ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn
  FROM sr_latest
),
assignment_norm AS (
  SELECT
    split_part(user_id, ':', 1) AS user_id_norm,
    lower(regexp_replace(system_role, '^jira:', '')) AS system_role_norm,
    CASE WHEN upper(coalesce(grant_origin, '')) = 'BUSINESS_ROLE' THEN 'BR'::"AssignmentSource" ELSE 'DIRECT'::"AssignmentSource" END AS source
  FROM assignment
  WHERE upper(coalesce(status, '')) = 'ACTIVE'
)
INSERT INTO "UserPermissionAssignment" (id, "userId", "permissionId", source, "createdAt")
SELECT
  md5(an.user_id_norm || ':' || sm.permission_id || ':' || an.source::text),
  an.user_id_norm,
  sm.permission_id,
  an.source,
  now()
FROM assignment_norm an
JOIN sr_map sm ON sm.tech_norm = an.system_role_norm AND sm.rn = 1
JOIN "User" u ON u.id = an.user_id_norm
JOIN "Permission" p ON p.id = sm.permission_id
ON CONFLICT DO NOTHING;

WITH sr_src AS (
  SELECT
    id,
    technical_id,
    updated_at,
    _row_id,
    ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn_id
  FROM system_roles
  WHERE lower(coalesce(is_current, 'false')) = 'true'
),
sr_latest AS (
  SELECT
    id,
    lower(COALESCE(NULLIF(technical_id, ''), id)) AS tech_norm,
    updated_at,
    _row_id
  FROM sr_src
  WHERE rn_id = 1
),
sr_map AS (
  SELECT
    id AS permission_id,
    tech_norm,
    ROW_NUMBER() OVER (PARTITION BY tech_norm ORDER BY updated_at DESC NULLS LAST, _row_id DESC) AS rn
  FROM sr_latest
),
snapshot_norm AS (
  SELECT
    user_id AS user_id_norm,
    lower(regexp_replace(item_technical_id, '^jira:', '')) AS system_role_norm,
    bool_or(pacote_id IS NOT NULL AND btrim(pacote_id) <> '') AS has_pacote
  FROM snapshot_user_entitlements_detailed
  WHERE user_id IS NOT NULL
    AND item_technical_id IS NOT NULL
    AND btrim(user_id) <> ''
    AND btrim(item_technical_id) <> ''
  GROUP BY user_id, lower(regexp_replace(item_technical_id, '^jira:', ''))
)
INSERT INTO "UserPermissionAssignment" (id, "userId", "permissionId", source, "createdAt")
SELECT
  md5(sn.user_id_norm || ':' || sm.permission_id || ':SNAPSHOT'),
  sn.user_id_norm,
  sm.permission_id,
  CASE
    WHEN sn.has_pacote THEN 'BR'::"AssignmentSource"
    ELSE 'DIRECT'::"AssignmentSource"
  END,
  now()
FROM snapshot_norm sn
JOIN sr_map sm ON sm.tech_norm = sn.system_role_norm AND sm.rn = 1
JOIN "User" u ON u.id = sn.user_id_norm
JOIN "Permission" p ON p.id = sm.permission_id
ON CONFLICT (id) DO UPDATE
SET
  source = EXCLUDED.source;

DELETE FROM "user_role_assignments";

INSERT INTO "user_role_assignments" ("user_id", "role", "created_at", "updated_at")
SELECT u.id, 'USER'::"UserRole", now(), now()
FROM "User" u
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

INSERT INTO "user_role_assignments" ("user_id", "role", "created_at", "updated_at")
SELECT DISTINCT g."userId", 'ADMIN'::"UserRole", now(), now()
FROM "UserScimGroup" g
WHERE lower(g.value) = 'sr-security-cybersec-iam'
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

COMMIT;
