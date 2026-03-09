CREATE OR REPLACE FUNCTION public.generate_system_role_description(technical_id text, role_name text, system_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  tid text := lower(coalesce(technical_id, ''));
  rname text := lower(coalesce(role_name, ''));
  combined text := trim(tid || ' ' || rname || ' ' || lower(coalesce(system_name, '')));
  system_label text;
  target_label text;
  role_prefix text;
  role_suffix text;
  env_suffix text;
  area_raw text;
  area_label text;
  vpn_profile_raw text;
  vpn_profile_label text;
  vpn_tier text;
  approval_object text;
BEGIN
  role_prefix := public.sr_human_label(NULLIF(split_part(coalesce(role_name, ''), ' - ', 1), ''));
  role_suffix := public.sr_human_label(NULLIF(regexp_replace(coalesce(role_name, ''), '^[^-]+\s*-\s*', ''), ''));

  system_label := public.sr_canonical_system_name(
    COALESCE(NULLIF(system_name, ''), NULLIF(role_prefix, ''), NULLIF(split_part(regexp_replace(coalesce(technical_id, ''), '^sr[-_]*', '', 'i'), '-', 1), ''), 'plataforma')
  );

  target_label := system_label;

  IF system_label IN ('JumpCloud', 'Google Workspace', 'Unico Identity')
    AND role_prefix <> ''
    AND lower(role_prefix) NOT IN ('area', 'departamento', 'time', 'squad', 'global', 'all', 'gcp', 'datalake', 'chapter', 'tribe', 'eng') THEN
    target_label := public.sr_canonical_system_name(role_prefix);
  END IF;

  env_suffix := public.sr_detect_environment(combined);

  IF combined = '' THEN
    RETURN 'Concede acesso ao sistema.';
  END IF;

  IF tid ~ '^sr-(area|departamento|time|squad)-' AND (system_label = 'JumpCloud' OR system_label = 'Google Workspace') THEN
    area_raw := regexp_replace(tid, '^sr-(area|departamento|time|squad)-', '');
    area_raw := regexp_replace(area_raw, '-(prod|production|prd|hml|homol|homolog|stg|staging|dev|qa|sandbox)$', '');
    area_label := public.sr_human_label(area_raw);

    IF area_label = 'Dados Dad' OR area_label = 'Dados DAD' THEN
      area_label := 'Dados (DAD)';
    END IF;

    RETURN format('Concede acesso aos recursos e aplicacoes da area %s atraves do SSO da organizacao.', area_label);
  END IF;

  IF combined ~ '(^|[^a-z])(vpn)([^a-z]|$)' THEN
    IF tid ~ '^sr-vpn-vpn-(.+)-(primario|secundario)$' THEN
      vpn_profile_raw := regexp_replace(tid, '^sr-vpn-vpn-(.+)-(primario|secundario)$', E'\\1');
      vpn_tier := regexp_replace(tid, '^sr-vpn-vpn-(.+)-(primario|secundario)$', E'\\2');
      vpn_profile_label := public.sr_human_label(vpn_profile_raw);
      RETURN format('Concede acesso a VPN do %s com o perfil %s %s.', target_label, vpn_profile_label, public.sr_human_label(vpn_tier));
    END IF;

    RETURN format('Concede acesso a VPN do %s%s.', target_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(sso|autenticacao|autentica|authentication|login)([^a-z]|$)' THEN
    RETURN format('Concede acesso de autenticacao a plataforma %s%s.', target_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(apr|approver|aprovador|approval)([^a-z]|$)' THEN
    IF combined ~ '(pull.?request|prs|(^|[^a-z])pr([^a-z]|$))' THEN
      approval_object := 'pull requests';
    ELSIF combined ~ '(query|queries|sql|database|banco|db)' OR (system_label = 'Hoop.dev' AND tid LIKE '%hoopdev%') THEN
      approval_object := 'requisicoes de execucao de queries';
    ELSIF combined ~ '(acesso|access|requisicao|request)' THEN
      approval_object := 'solicitacoes de acesso';
    ELSIF combined ~ '(firewall)' THEN
      approval_object := 'alteracoes de firewall';
    ELSE
      approval_object := 'fluxos de aprovacao';
    END IF;

    IF approval_object = 'requisicoes de execucao de queries' AND system_label = 'Hoop.dev' THEN
      RETURN format('Permite aprovar ou negar %s no %s%s, sem conceder acesso direto ao banco.', approval_object, 'Hoop.dev', env_suffix);
    END IF;

    RETURN format('Permite aprovar ou negar %s no %s%s, sem conceder acesso operacional direto.', approval_object, target_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(admin|administrator|administrativo|owner-admin|owner)([^a-z]|$)' THEN
    RETURN format('Concede acesso administrativo a plataforma %s%s.', target_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(reader|read|readonly|viewer|visualizacao|view|leitor|consulta|auditoria|audit)([^a-z]|$)' THEN
    RETURN format('Concede permissao de leitura no %s, permitindo visualizar informacoes sem realizar alteracoes.', target_label);
  END IF;

  IF combined ~ '(^|[^a-z])(developer|dev|engineer|swe)([^a-z]|$)' THEN
    RETURN format('Concede acesso tecnico para desenvolvimento na plataforma %s%s.', target_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(group|grupo|team|tribe|chapter|users|all-users|all users)([^a-z]|$)' THEN
    IF role_suffix = '' THEN
      role_suffix := public.sr_human_label(regexp_replace(tid, '^sr-', ''));
    END IF;
    RETURN format('Concede acesso ao grupo %s na plataforma %s.', role_suffix, target_label);
  END IF;

  IF role_suffix <> '' AND lower(role_suffix) <> lower(target_label) THEN
    RETURN format('Concede acesso a plataforma %s com o perfil %s%s.', target_label, role_suffix, env_suffix);
  END IF;

  RETURN format('Concede acesso a plataforma %s%s.', target_label, env_suffix);
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
