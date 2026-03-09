CREATE OR REPLACE FUNCTION public.sr_human_label(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
BEGIN
  t := lower(coalesce(value, ''));
  t := regexp_replace(t, '^sr[-_]*', '', 'g');
  t := replace(replace(t, '.', ' '), '/', ' ');
  t := replace(replace(t, '_', ' '), '-', ' ');
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := btrim(t);

  IF t = '' THEN
    RETURN '';
  END IF;

  IF t = 'bizops' THEN RETURN 'BizOps'; END IF;
  IF t = 'dados dad' THEN RETURN 'Dados (DAD)'; END IF;

  t := initcap(t);
  t := regexp_replace(t, '(^| )Sso($| )', '\1SSO\2', 'g');
  t := regexp_replace(t, '(^| )Iam($| )', '\1IAM\2', 'g');
  t := regexp_replace(t, '(^| )Vpn($| )', '\1VPN\2', 'g');
  t := regexp_replace(t, '(^| )Api($| )', '\1API\2', 'g');
  t := regexp_replace(t, '(^| )Sql($| )', '\1SQL\2', 'g');
  t := regexp_replace(t, '(^| )Prs($| )', '\1PRs\2', 'g');
  t := regexp_replace(t, '(^| )Sre($| )', '\1SRE\2', 'g');
  t := regexp_replace(t, '(^| )Dad($| )', '\1DAD\2', 'g');

  RETURN btrim(t);
END;
$$;

CREATE OR REPLACE FUNCTION public.sr_canonical_system_name(value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(coalesce(value, ''));
BEGIN
  IF v = '' THEN RETURN 'plataforma'; END IF;

  IF v LIKE '%jumpcloud%' THEN RETURN 'JumpCloud'; END IF;
  IF v LIKE '%github%' THEN RETURN 'GitHub'; END IF;
  IF v LIKE '%checkmarx%' THEN RETURN 'Checkmarx'; END IF;
  IF v LIKE '%claude code%' OR v LIKE '%claudecode%' THEN RETURN 'Claude Code'; END IF;
  IF v LIKE '%hoop%' THEN RETURN 'Hoop.dev'; END IF;
  IF v LIKE '%fortclient%' OR v LIKE '%forticlient%' OR v LIKE '%fortigate%' THEN RETURN 'FortiClient'; END IF;
  IF v LIKE '%aws%' THEN RETURN 'AWS'; END IF;
  IF v LIKE '%argocd%' THEN RETURN 'ArgoCD'; END IF;
  IF v LIKE '%launchdarkly%' THEN RETURN 'LaunchDarkly'; END IF;
  IF v LIKE '%miro%' THEN RETURN 'Miro'; END IF;
  IF v LIKE '%new relic%' THEN RETURN 'New Relic'; END IF;
  IF v LIKE '%google workspaces%' THEN RETURN 'Google Workspace'; END IF;

  RETURN public.sr_human_label(value);
END;
$$;

CREATE OR REPLACE FUNCTION public.sr_detect_environment(text_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text := lower(coalesce(text_value, ''));
BEGIN
  IF t ~ '(^|[^a-z])(prod|production|prd)([^a-z]|$)' THEN RETURN ' em producao'; END IF;
  IF t ~ '(^|[^a-z])(hml|homol|homolog)([^a-z]|$)' THEN RETURN ' em homologacao'; END IF;
  IF t ~ '(^|[^a-z])(stg|staging)([^a-z]|$)' THEN RETURN ' em staging'; END IF;
  IF t ~ '(^|[^a-z])(dev)([^a-z]|$)' THEN RETURN ' em desenvolvimento'; END IF;
  IF t ~ '(^|[^a-z])(qa|sandbox)([^a-z]|$)' THEN RETURN ' em ambiente de testes'; END IF;
  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_system_role_description(technical_id text, role_name text, system_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  tid text := lower(coalesce(technical_id, ''));
  rname text := lower(coalesce(role_name, ''));
  combined text := trim(tid || ' ' || rname || ' ' || lower(coalesce(system_name, '')));
  system_label text;
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
      RETURN format('Concede acesso a VPN do %s com o perfil %s %s.', system_label, vpn_profile_label, public.sr_human_label(vpn_tier));
    END IF;

    RETURN format('Concede acesso a VPN do %s%s.', system_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(sso|autenticacao|autentica|authentication|login)([^a-z]|$)' THEN
    IF role_prefix <> '' AND role_prefix NOT IN ('Area', 'Departamento', 'Time', 'Squad', 'Gcp', 'Datalake') THEN
      system_label := public.sr_canonical_system_name(role_prefix);
    END IF;

    RETURN format('Concede acesso de autenticacao a plataforma %s%s.', system_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(apr|approver|aprovador|approval)([^a-z]|$)' THEN
    IF combined ~ '(pull.?request|\bprs\b|\bpr\b)' THEN
      approval_object := 'pull requests';
    ELSIF combined ~ '(query|queries|sql|database|banco|db)' THEN
      approval_object := 'requisicoes de execucao de queries';
    ELSIF combined ~ '(acesso|access|requisicao|request)' THEN
      approval_object := 'solicitacoes de acesso';
    ELSIF combined ~ '(firewall)' THEN
      approval_object := 'alteracoes de firewall';
    ELSE
      approval_object := 'fluxos de aprovacao';
    END IF;

    IF role_prefix <> '' AND role_prefix NOT IN ('Area', 'Departamento', 'Time', 'Squad', 'Gcp', 'Datalake') THEN
      system_label := public.sr_canonical_system_name(role_prefix);
    END IF;

    IF approval_object = 'requisicoes de execucao de queries' AND public.sr_canonical_system_name(coalesce(system_name, '')) = 'Hoop.dev' THEN
      RETURN format('Permite aprovar ou negar %s no %s%s, sem conceder acesso direto ao banco.', approval_object, 'Hoop.dev', env_suffix);
    END IF;

    RETURN format('Permite aprovar ou negar %s no %s%s, sem conceder acesso operacional direto.', approval_object, system_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(admin|administrator|administrativo|owner-admin|owner)([^a-z]|$)' THEN
    RETURN format('Concede acesso administrativo a plataforma %s%s.', system_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(reader|read|readonly|viewer|visualizacao|view|leitor|consulta|auditoria|audit)([^a-z]|$)' THEN
    RETURN format('Concede permissao de leitura no %s, permitindo visualizar informacoes sem realizar alteracoes.', system_label);
  END IF;

  IF combined ~ '(^|[^a-z])(developer|dev|engineer|swe)([^a-z]|$)' THEN
    RETURN format('Concede acesso tecnico para desenvolvimento na plataforma %s%s.', system_label, env_suffix);
  END IF;

  IF combined ~ '(^|[^a-z])(group|grupo|team|tribe|chapter|users|all-users|all users)([^a-z]|$)' THEN
    IF role_suffix = '' THEN
      role_suffix := public.sr_human_label(regexp_replace(tid, '^sr-', ''));
    END IF;
    RETURN format('Concede acesso ao grupo %s na plataforma %s.', role_suffix, system_label);
  END IF;

  IF role_suffix <> '' AND lower(role_suffix) <> lower(system_label) THEN
    RETURN format('Concede acesso a plataforma %s com o perfil %s%s.', system_label, role_suffix, env_suffix);
  END IF;

  RETURN format('Concede acesso a plataforma %s%s.', system_label, env_suffix);
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
