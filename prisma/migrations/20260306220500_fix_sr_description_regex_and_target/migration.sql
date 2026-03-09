CREATE OR REPLACE FUNCTION public.sr_normalize_label(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN value IS NULL OR btrim(value) = '' THEN ''
    ELSE initcap(regexp_replace(replace(replace(btrim(value), '_', ' '), '-', ' '), '\s+', ' ', 'g'))
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
  role_prefix_label text;
  system_label text;
  target_system_label text;
  role_tail_raw text;
  role_tail_label text;
  vpn_profile text;
  vpn_tier text;
BEGIN
  role_prefix_label := public.sr_normalize_label(NULLIF(split_part(coalesce(role_name, ''), ' - ', 1), ''));

  system_label := public.sr_normalize_label(
    COALESCE(
      NULLIF(system_name, ''),
      NULLIF(role_prefix_label, ''),
      NULLIF(regexp_replace(coalesce(technical_id, ''), '^sr[-_]?', '', 'i'), ''),
      'Sistema'
    )
  );

  target_system_label := system_label;

  role_tail_raw := NULLIF(regexp_replace(coalesce(role_name, ''), '^[^-]+\s*-\s*', ''), '');
  IF role_tail_raw IS NULL THEN
    role_tail_raw := NULLIF(regexp_replace(coalesce(technical_id, ''), '^sr-?[^-]+-?', '', 'i'), '');
  END IF;

  role_tail_label := public.sr_normalize_label(COALESCE(role_tail_raw, technical_id));

  IF role_tail_label <> '' AND role_prefix_label <> '' AND left(lower(role_tail_label), length(lower(role_prefix_label))) = lower(role_prefix_label) THEN
    role_tail_label := public.sr_normalize_label(btrim(substr(role_tail_label, length(role_prefix_label) + 1)));
  END IF;

  IF combined = '' THEN
    RETURN 'Concede acesso tecnico ao sistema.';
  END IF;

  IF combined ~ '(^|[^a-z])(sso|autenticacao|autentica|authentication|login|aprovador|approver|apr)([^a-z]|$)'
    AND role_prefix_label <> ''
    AND lower(role_prefix_label) NOT IN ('area', 'chapter', 'tribe', 'all', 'eng', 'gcp', 'datalake') THEN
    target_system_label := role_prefix_label;
  END IF;

  IF combined ~ '(^|[^a-z])(vpn)([^a-z]|$)' THEN
    IF tid ~ '^sr-vpn-vpn-(.+)-(primario|secundario)$' THEN
      vpn_profile := public.sr_normalize_label(regexp_replace(tid, '^sr-vpn-vpn-(.+)-(primario|secundario)$', '\1'));
      vpn_tier := lower(regexp_replace(tid, '^sr-vpn-vpn-(.+)-(primario|secundario)$', '\2'));
      RETURN format('Concede acesso a VPN do %s com o perfil %s (%s).', target_system_label, vpn_profile, vpn_tier);
    END IF;
    RETURN format('Concede acesso a VPN do %s.', target_system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(sso|autenticacao|autentica|authentication|login)([^a-z]|$)' THEN
    RETURN format('Concede acesso ao %s.', target_system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(aprovador|approver|apr)([^a-z]|$)' THEN
    RETURN format('Permite aprovar solicitacoes de acesso relacionadas ao %s.', target_system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(admin|administrator|owner|root|superuser|admins)([^a-z]|$)' THEN
    RETURN format('Concede perfil administrativo no %s.', target_system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(viewer|readonly|read|consulta|auditoria|audit|analise|analyst|reader|leitor|data\.viewer|project\.viewer|logging\.viewer)([^a-z]|$)' THEN
    RETURN format('Concede acesso de leitura e consulta no %s.', target_system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(write|editor|contributor|operator|ops|rw|manager)([^a-z]|$)' THEN
    RETURN format('Concede acesso de operacao com permissao de alteracao no %s.', target_system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(developer|dev|engineer|swe)([^a-z]|$)' THEN
    RETURN format('Concede acesso tecnico para desenvolvimento no %s.', target_system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(grupo|group|team|chapter|tribe|area|all users|users)([^a-z]|$)' AND role_tail_label <> '' THEN
    RETURN format('Concede participacao no grupo %s do %s.', role_tail_label, target_system_label);
  END IF;

  IF role_tail_label = '' OR lower(role_tail_label) = lower(target_system_label) THEN
    RETURN format('Concede acesso ao %s.', target_system_label);
  END IF;

  RETURN format('Concede acesso ao %s com a role %s.', target_system_label, role_tail_label);
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
