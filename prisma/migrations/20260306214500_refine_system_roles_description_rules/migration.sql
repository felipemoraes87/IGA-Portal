CREATE OR REPLACE FUNCTION public.sr_normalize_label(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL OR btrim(value) = '' THEN ''
    ELSE initcap(regexp_replace(replace(replace(btrim(value), '_', ' '), '-', ' '), '\\s+', ' ', 'g'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.generate_system_role_description(technical_id text, role_name text, system_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  tid text := lower(coalesce(technical_id, ''));
  rname text := lower(coalesce(role_name, ''));
  combined text := trim(tid || ' ' || rname);
  role_tail_raw text;
  role_tail_label text;
  system_label text;
  vpn_profile text;
  vpn_tier text;
BEGIN
  system_label := public.sr_normalize_label(
    COALESCE(
      NULLIF(system_name, ''),
      NULLIF(split_part(coalesce(role_name, ''), ' - ', 1), ''),
      NULLIF(regexp_replace(coalesce(technical_id, ''), '^sr[-_]?', '', 'i'), ''),
      'Sistema'
    )
  );

  role_tail_raw := NULLIF(regexp_replace(coalesce(role_name, ''), '^[^-]+\\s*-\\s*', ''), '');
  IF role_tail_raw IS NULL THEN
    role_tail_raw := NULLIF(regexp_replace(coalesce(technical_id, ''), '^sr-?[^-]+-?', '', 'i'), '');
  END IF;
  role_tail_label := public.sr_normalize_label(COALESCE(role_tail_raw, technical_id));

  IF combined = '' THEN
    RETURN 'Concede acesso tecnico ao sistema.';
  END IF;

  IF combined ~ '(^|[^a-z])(vpn)([^a-z]|$)' THEN
    IF tid ~ '^sr-vpn-vpn-(.+)-(primario|secundario)$' THEN
      vpn_profile := public.sr_normalize_label(regexp_replace(tid, '^sr-vpn-vpn-(.+)-(primario|secundario)$', '\\1'));
      vpn_tier := lower(regexp_replace(tid, '^sr-vpn-vpn-(.+)-(primario|secundario)$', '\\2'));
      RETURN format('Concede acesso a VPN do %s com o perfil %s (%s).', system_label, vpn_profile, vpn_tier);
    END IF;
    RETURN format('Concede acesso a VPN do %s.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(sso|autenticacao|autentica|authentication|login)([^a-z]|$)' THEN
    RETURN format('Concede acesso ao %s.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(aprovador|approver|apr)([^a-z]|$)' THEN
    RETURN format('Permite aprovar solicitacoes de acesso relacionadas ao %s.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(admin|administrator|owner|root|superuser|admins)([^a-z]|$)' THEN
    RETURN format('Concede perfil administrativo no %s.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(viewer|readonly|read|consulta|auditoria|audit|analise|analyst|reader|leitor|data\\.viewer|project\\.viewer|logging\\.viewer)([^a-z]|$)' THEN
    RETURN format('Concede acesso de leitura e consulta no %s.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(write|editor|contributor|operator|ops|rw|manager|owner)([^a-z]|$)' THEN
    RETURN format('Concede acesso de operacao com permissao de alteracao no %s.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(developer|dev|engineer|swe)([^a-z]|$)' THEN
    RETURN format('Concede acesso tecnico para desenvolvimento no %s.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(grupo|group|team|chapter|tribe|area|all users|users)([^a-z]|$)' AND role_tail_label <> '' THEN
    RETURN format('Concede participacao no grupo %s do %s.', role_tail_label, system_label);
  END IF;

  IF role_tail_label = '' OR lower(role_tail_label) = lower(system_label) THEN
    RETURN format('Concede acesso ao %s.', system_label);
  END IF;

  RETURN format('Concede acesso ao %s com a role %s.', system_label, role_tail_label);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_system_role_description(technical_id text, role_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN public.generate_system_role_description(technical_id, role_name, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fill_system_roles_description()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_system_name text;
BEGIN
  SELECT s.name
    INTO v_system_name
  FROM softwares s
  WHERE s.id = NEW.software_id
  ORDER BY s._row_id DESC
  LIMIT 1;

  IF NEW.description IS NULL OR btrim(NEW.description) = '' THEN
    NEW.description := public.generate_system_role_description(NEW.technical_id, NEW.name, v_system_name);
  ELSIF TG_OP = 'UPDATE'
    AND NEW.description = OLD.description
    AND (
      NEW.technical_id IS DISTINCT FROM OLD.technical_id
      OR NEW.name IS DISTINCT FROM OLD.name
      OR NEW.software_id IS DISTINCT FROM OLD.software_id
    ) THEN
    NEW.description := public.generate_system_role_description(NEW.technical_id, NEW.name, v_system_name);
  END IF;

  RETURN NEW;
END;
$$;

UPDATE system_roles sr
SET description = public.generate_system_role_description(
  sr.technical_id,
  sr.name,
  (
    SELECT s.name
    FROM softwares s
    WHERE s.id = sr.software_id
    ORDER BY s._row_id DESC
    LIMIT 1
  )
);

UPDATE "Permission" p
SET description = sr.description,
    "updatedAt" = now()
FROM system_roles sr
WHERE sr.id = p.id
  AND sr.description IS NOT NULL
  AND btrim(sr.description) <> ''
  AND p.description IS DISTINCT FROM sr.description;
