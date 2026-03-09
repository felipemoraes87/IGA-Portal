ALTER TABLE "system_roles"
ADD COLUMN IF NOT EXISTS "description" TEXT;

CREATE OR REPLACE FUNCTION public.generate_system_role_description(technical_id text, role_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  source_text text := lower(trim(concat_ws(' ', coalesce(technical_id, ''), coalesce(role_name, ''))));
BEGIN
  IF source_text = '' THEN
    RETURN 'Acesso a role tecnica do sistema.';
  END IF;

  IF source_text ~ '(^|[^a-z])(sso|autenticacao|autentica|authentication|login)([^a-z]|$)' THEN
    RETURN 'Acesso de autenticacao (SSO/login) ao sistema.';
  END IF;

  IF source_text ~ '(^|[^a-z])(aprovador|approver|apr)([^a-z]|$)' THEN
    RETURN 'Permite aprovar solicitacoes de acesso neste sistema.';
  END IF;

  IF source_text ~ '(^|[^a-z])(admin|administrator|owner|superuser|root)([^a-z]|$)' THEN
    RETURN 'Acesso administrativo com privilegios elevados no sistema.';
  END IF;

  IF source_text ~ '(^|[^a-z])(viewer|read|readonly|consulta|auditoria|audit|analise|analyst|data\.viewer|project\.viewer|logging\.viewer)([^a-z]|$)' THEN
    RETURN 'Acesso de leitura/consulta para dados e recursos do sistema.';
  END IF;

  IF source_text ~ '(^|[^a-z])(developer|dev|engineer)([^a-z]|$)' THEN
    RETURN 'Acesso para desenvolvimento e operacao tecnica no sistema.';
  END IF;

  IF source_text ~ '(^|[^a-z])(editor|write|writer|contributor|operator|ops)([^a-z]|$)' THEN
    RETURN 'Acesso operacional com permissoes de alteracao no sistema.';
  END IF;

  IF source_text ~ '(^|[^a-z])(data\.owner|manager)([^a-z]|$)' THEN
    RETURN 'Acesso de gestao para administracao de dados e recursos no sistema.';
  END IF;

  RETURN 'Acesso tecnico a recursos especificos do sistema.';
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fill_system_roles_description()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.description IS NULL OR btrim(NEW.description) = '' THEN
    NEW.description := public.generate_system_role_description(NEW.technical_id, NEW.name);
  ELSIF TG_OP = 'UPDATE'
    AND (NEW.technical_id IS DISTINCT FROM OLD.technical_id OR NEW.name IS DISTINCT FROM OLD.name)
    AND (OLD.description IS NULL OR OLD.description = public.generate_system_role_description(OLD.technical_id, OLD.name)) THEN
    NEW.description := public.generate_system_role_description(NEW.technical_id, NEW.name);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_system_roles_fill_description ON "system_roles";
CREATE TRIGGER trg_system_roles_fill_description
BEFORE INSERT OR UPDATE OF technical_id, name, description
ON "system_roles"
FOR EACH ROW
EXECUTE FUNCTION public.trg_fill_system_roles_description();

UPDATE "system_roles"
SET "description" = public.generate_system_role_description(technical_id, name)
WHERE "description" IS NULL OR btrim("description") = '';
