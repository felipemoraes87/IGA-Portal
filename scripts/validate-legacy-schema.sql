DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'Missing required legacy table: public.users';
  END IF;
  IF to_regclass('public.assignment') IS NULL THEN
    RAISE EXCEPTION 'Missing required legacy table: public.assignment';
  END IF;
  IF to_regclass('public.system_roles') IS NULL THEN
    RAISE EXCEPTION 'Missing required legacy table: public.system_roles';
  END IF;
  IF to_regclass('public.business_roles') IS NULL THEN
    RAISE EXCEPTION 'Missing required legacy table: public.business_roles';
  END IF;
  IF to_regclass('public.system_business_roles') IS NULL THEN
    RAISE EXCEPTION 'Missing required legacy table: public.system_business_roles';
  END IF;
  IF to_regclass('public.softwares') IS NULL THEN
    RAISE EXCEPTION 'Missing required legacy table: public.softwares';
  END IF;
  IF to_regclass('public.snapshot_br_users_match') IS NULL THEN
    RAISE EXCEPTION 'Missing required legacy table: public.snapshot_br_users_match';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'Column users.id is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_current'
  ) THEN
    RAISE EXCEPTION 'Column users.is_current is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    RAISE EXCEPTION 'Column users.updated_at is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_roles' AND column_name = 'technical_id'
  ) THEN
    RAISE EXCEPTION 'Column system_roles.technical_id is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'assignment' AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'Column assignment.status is required';
  END IF;
END $$;

SELECT 'Legacy schema validation passed' AS result;
