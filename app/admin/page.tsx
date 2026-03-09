import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type KV = { label: string; value: number };
type LinePoint = { label: string; brCount: number; areaCoverage: number };

const ADMIN_DASHBOARD_CACHE_TTL_MS = 600_000;
let adminDashboardCache:
  | {
      expiresAt: number;
      data: unknown;
    }
  | null = null;

async function withAdminDashboardCache<T>(loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (adminDashboardCache && adminDashboardCache.expiresAt > now) {
    return adminDashboardCache.data as T;
  }
  const data = await loader();
  adminDashboardCache = {
    expiresAt: now + ADMIN_DASHBOARD_CACHE_TTL_MS,
    data,
  };
  return data;
}

export default async function AdminHomePage() {
  const user = await requirePageUser("ADMIN");

  const [
    activeUsersCount,
    totalBrCount,
    activeAreasCount,
    avgSrPerBrRes,
    evolutionRes,
    brLeaderboardRes,
    brCoverageCriteriaSplitRes,
    totalAccessesGranted,
    usersWithBrRes,
    topUsersSrRes,
    topAreasRes,
    usersNoAccessRes,
    topBrRes,
    workforceSplitRes,
    actionStatsRes,
    systemsCoveredRes,
    srCoveredRes,
    execHistogramRes,
    accessBySystemRes,
  ] = await withAdminDashboardCache(() => Promise.all([
    db.user.count({ where: { active: true } }),
    db.$queryRaw<Array<{ total_br: bigint }>>`
      SELECT COUNT(DISTINCT br.id) AS total_br
      FROM business_roles br
      WHERE lower(coalesce(br.is_current, 'false')) = 'true'
    `,
    db.$queryRaw<Array<{ total_areas: bigint }>>`
      SELECT COUNT(DISTINCT o.id) AS total_areas
      FROM organizational o
      JOIN users u ON u.organizational_id = o.id
      JOIN "User" pu ON pu.id = u.id
      WHERE lower(coalesce(o.is_current, 'false')) = 'true'
        AND lower(coalesce(u.is_current, 'false')) = 'true'
        AND pu.active = true
    `,
    db.$queryRaw<Array<{ avg_sr_per_br: number }>>`
      WITH br_sr AS (
        SELECT sbr.business_role_id, COUNT(DISTINCT sr.id) AS sr_count
        FROM system_business_roles sbr
        JOIN business_roles br ON br.id = sbr.business_role_id
        JOIN system_roles sr ON sr.id = sbr.system_role_id
        JOIN softwares sw ON sw.id = sr.software_id
        WHERE lower(coalesce(sbr.is_current, 'true')) = 'true'
          AND lower(coalesce(br.is_current, 'false')) = 'true'
          AND lower(coalesce(sr.is_current, 'false')) = 'true'
          AND lower(coalesce(sw.is_current, 'false')) = 'true'
        GROUP BY sbr.business_role_id
      )
      SELECT COALESCE(AVG(sr_count), 0)::float AS avg_sr_per_br FROM br_sr
    `,
    db.$queryRaw<Array<{ month_label: string; br_count: bigint; area_coverage: bigint }>>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', current_date - interval '11 months')::date,
          date_trunc('month', current_date)::date,
          interval '1 month'
        )::date AS month_ref
      ),
      br_first_month AS (
        SELECT
          br.id,
          MIN(date_trunc('month', br.created_at::timestamptz)::date) AS first_month
        FROM business_roles br
        WHERE lower(coalesce(br.is_current, 'false')) = 'true'
        GROUP BY br.id
      ),
      area_first_month AS (
        SELECT
          obr.organizational_id,
          MIN(date_trunc('month', obr.created_at::timestamptz)::date) AS first_month
        FROM organizational_business_roles obr
        JOIN business_roles br ON br.id = obr.business_role_id
        JOIN organizational o ON o.id = obr.organizational_id
        WHERE lower(coalesce(obr.is_current, 'true')) = 'true'
          AND lower(coalesce(br.is_current, 'false')) = 'true'
          AND lower(coalesce(o.is_current, 'false')) = 'true'
        GROUP BY obr.organizational_id
      )
      SELECT
        to_char(m.month_ref, 'Mon/YY') AS month_label,
        COUNT(DISTINCT b.id) FILTER (WHERE b.first_month <= m.month_ref) AS br_count,
        COUNT(DISTINCT a.organizational_id) FILTER (WHERE a.first_month <= m.month_ref) AS area_coverage
      FROM months m
      LEFT JOIN br_first_month b ON true
      LEFT JOIN area_first_month a ON true
      GROUP BY m.month_ref
      ORDER BY m.month_ref
    `,
    db.$queryRaw<Array<{ br_name: string; users_count: bigint; sr_count: bigint }>>`
      WITH br_current AS (
        SELECT DISTINCT ON (br.id)
          br.id,
          br.name,
          br.technical_id
        FROM business_roles br
        WHERE lower(coalesce(br.is_current, 'false')) = 'true'
        ORDER BY br.id, br.updated_at DESC NULLS LAST, br._row_id DESC
      ),
      br_users AS (
        SELECT
          m.br_id,
          COUNT(DISTINCT pu.id) AS users_count
        FROM snapshot_br_users_match m
        JOIN "User" pu ON pu.id = m.user_id
        JOIN br_current br ON br.id = m.br_id
        WHERE pu.active = true
        GROUP BY m.br_id
      ),
      br_srs AS (
        SELECT
          sbr.business_role_id AS br_id,
          COUNT(DISTINCT sr.id) AS sr_count
        FROM system_business_roles sbr
        JOIN br_current br ON br.id = sbr.business_role_id
        JOIN system_roles sr ON sr.id = sbr.system_role_id
        JOIN softwares sw ON sw.id = sr.software_id
        WHERE lower(coalesce(sbr.is_current, 'true')) = 'true'
          AND lower(coalesce(sr.is_current, 'false')) = 'true'
          AND lower(coalesce(sw.is_current, 'false')) = 'true'
        GROUP BY sbr.business_role_id
      )
      SELECT
        x.br_name,
        MAX(x.users_count) AS users_count,
        MAX(x.sr_count) AS sr_count
      FROM (
        SELECT
          COALESCE(NULLIF(br.name, ''), NULLIF(br.technical_id, ''), 'Sem BR') AS br_name,
          bu.users_count,
          COALESCE(bs.sr_count, 0) AS sr_count
        FROM br_users bu
        JOIN br_current br ON br.id = bu.br_id
        LEFT JOIN br_srs bs ON bs.br_id = bu.br_id
      ) x
      GROUP BY x.br_name
      ORDER BY MAX(x.users_count) DESC, MAX(x.sr_count) DESC
      LIMIT 10
    `,
    db.$queryRaw<Array<{ employees: bigint; third_parties: bigint }>>`
      WITH br_current AS (
        SELECT DISTINCT ON (br.id) br.id
        FROM business_roles br
        WHERE lower(coalesce(br.is_current, 'false')) = 'true'
        ORDER BY br.id, br.updated_at DESC NULLS LAST, br._row_id DESC
      ),
      covered_users AS (
        SELECT DISTINCT m.user_id
        FROM snapshot_br_users_match m
        JOIN "User" pu ON pu.id = m.user_id
        JOIN br_current br ON br.id = m.br_id
        WHERE pu.active = true
      ),
      users_latest AS (
        SELECT DISTINCT ON (u.id)
          u.id,
          lower(coalesce(u.contract_type, '')) AS contract_type
        FROM users u
        WHERE lower(coalesce(u.is_current, 'false')) = 'true'
        ORDER BY u.id, u.updated_at DESC NULLS LAST, u._row_id DESC
      )
      SELECT
        COUNT(DISTINCT cu.user_id) FILTER (
          WHERE ul.contract_type LIKE '%terceir%'
             OR ul.contract_type LIKE '%extern%'
             OR ul.contract_type LIKE '%pj%'
             OR ul.contract_type LIKE '%deel%'
             OR ul.contract_type LIKE '%advisor%'
        ) AS third_parties,
        COUNT(DISTINCT cu.user_id) FILTER (
          WHERE NOT (
            ul.contract_type LIKE '%terceir%'
            OR ul.contract_type LIKE '%extern%'
            OR ul.contract_type LIKE '%pj%'
            OR ul.contract_type LIKE '%deel%'
            OR ul.contract_type LIKE '%advisor%'
          )
        ) AS employees
      FROM covered_users cu
      LEFT JOIN users_latest ul ON ul.id = cu.user_id
    `,
    db.$queryRaw<Array<{ granted: bigint }>>`
      SELECT COUNT(*) AS granted
      FROM assignment a
      JOIN system_roles sr ON lower(sr.technical_id) = lower(regexp_replace(a.system_role, '^jira:', ''))
      JOIN softwares sw ON sw.id = sr.software_id
      WHERE upper(coalesce(a.status, '')) = 'ACTIVE'
        AND lower(coalesce(sr.is_current, 'false')) = 'true'
        AND lower(coalesce(sw.is_current, 'false')) = 'true'
    `,
    db.$queryRaw<Array<{ users_with_br: bigint }>>`
      SELECT COUNT(DISTINCT m.user_id) AS users_with_br
      FROM snapshot_br_users_match m
      JOIN "User" pu ON pu.id = m.user_id
      JOIN business_roles br ON br.id = m.br_id
      WHERE pu.active = true
        AND lower(coalesce(br.is_current, 'false')) = 'true'
    `,
    db.$queryRaw<Array<{ user_name: string; total_srs: bigint }>>`
      SELECT
        COALESCE(pu.name, split_part(a.user_id, ':', 1)) AS user_name,
        COUNT(DISTINCT lower(regexp_replace(a.system_role, '^jira:', ''))) AS total_srs
      FROM assignment a
      JOIN "User" pu ON pu.id = split_part(a.user_id, ':', 1)
      JOIN system_roles sr ON lower(sr.technical_id) = lower(regexp_replace(a.system_role, '^jira:', ''))
      JOIN softwares sw ON sw.id = sr.software_id
      WHERE pu.active = true
        AND upper(coalesce(a.status, '')) = 'ACTIVE'
        AND lower(coalesce(sr.is_current, 'false')) = 'true'
        AND lower(coalesce(sw.is_current, 'false')) = 'true'
      GROUP BY COALESCE(pu.name, split_part(a.user_id, ':', 1))
      ORDER BY total_srs DESC
      LIMIT 10
    `,
    db.$queryRaw<Array<{ area_name: string; total_srs: bigint }>>`
      WITH users_latest AS (
        SELECT DISTINCT ON (u.id)
          u.id,
          COALESCE(NULLIF(u.organizational, ''), u.organizational_id, 'SEM_AREA') AS area_name,
          u.updated_at,
          u._row_id
        FROM users u
        WHERE lower(coalesce(u.is_current, 'false')) = 'true'
        ORDER BY u.id, u.updated_at DESC NULLS LAST, u._row_id DESC
      )
      SELECT
        ul.area_name,
        COUNT(DISTINCT lower(regexp_replace(a.system_role, '^jira:', ''))) AS total_srs
      FROM assignment a
      JOIN "User" pu ON pu.id = split_part(a.user_id, ':', 1) AND pu.active = true
      JOIN users_latest ul ON ul.id = pu.id
      JOIN system_roles sr ON lower(sr.technical_id) = lower(regexp_replace(a.system_role, '^jira:', ''))
      JOIN softwares sw ON sw.id = sr.software_id
      WHERE upper(coalesce(a.status, '')) = 'ACTIVE'
        AND lower(coalesce(sr.is_current, 'false')) = 'true'
        AND lower(coalesce(sw.is_current, 'false')) = 'true'
      GROUP BY ul.area_name
      ORDER BY total_srs DESC
      LIMIT 10
    `,
    db.$queryRaw<Array<{ user_name: string; email: string }>>`
      SELECT pu.name AS user_name, pu.email
      FROM "User" pu
      WHERE pu.active = true
        AND NOT EXISTS (
          SELECT 1
          FROM snapshot_br_users_match m
          JOIN business_roles br ON br.id = m.br_id
          WHERE m.user_id = pu.id
            AND lower(coalesce(br.is_current, 'false')) = 'true'
        )
      ORDER BY pu.name
      LIMIT 20
    `,
    db.$queryRaw<Array<{ br_name: string; users_count: bigint }>>`
      SELECT
        COALESCE(NULLIF(br.name, ''), NULLIF(br.technical_id, ''), 'Sem BR') AS br_name,
        COUNT(DISTINCT m.user_id) AS users_count
      FROM snapshot_br_users_match m
      JOIN business_roles br ON br.id = m.br_id
      JOIN "User" pu ON pu.id = m.user_id
      WHERE pu.active = true
        AND lower(coalesce(br.is_current, 'false')) = 'true'
      GROUP BY COALESCE(NULLIF(br.name, ''), NULLIF(br.technical_id, ''), 'Sem BR')
      ORDER BY users_count DESC
      LIMIT 5
    `,
    db.$queryRaw<Array<{ employees: bigint; third_parties: bigint }>>`
      WITH users_latest AS (
        SELECT DISTINCT ON (u.id)
          u.id,
          lower(coalesce(u.contract_type, '')) AS contract_type
        FROM users u
        WHERE lower(coalesce(u.is_current, 'false')) = 'true'
        ORDER BY u.id, u.updated_at DESC NULLS LAST, u._row_id DESC
      )
      SELECT
        COUNT(DISTINCT pu.id) FILTER (
          WHERE ul.contract_type LIKE '%terceir%'
             OR ul.contract_type LIKE '%extern%'
             OR ul.contract_type LIKE '%pj%'
             OR ul.contract_type LIKE '%deel%'
             OR ul.contract_type LIKE '%advisor%'
        ) AS third_parties,
        COUNT(DISTINCT pu.id) FILTER (
          WHERE NOT (
            ul.contract_type LIKE '%terceir%'
            OR ul.contract_type LIKE '%extern%'
            OR ul.contract_type LIKE '%pj%'
            OR ul.contract_type LIKE '%deel%'
            OR ul.contract_type LIKE '%advisor%'
          )
        ) AS employees
      FROM "User" pu
      LEFT JOIN users_latest ul ON ul.id = pu.id
      WHERE pu.active = true
    `,
    db.$queryRaw<Array<{ granted: bigint; revoked: bigint }>>`
      SELECT
        COUNT(*) FILTER (WHERE upper(coalesce(action, '')) = 'GRANT') AS granted,
        COUNT(*) FILTER (WHERE upper(coalesce(action, '')) = 'REVOKE') AS revoked
      FROM assignment
      WHERE upper(coalesce(status, '')) IN ('ACTIVE', 'PENDING_ERROR', 'PENDINGERROR')
    `,
    db.$queryRaw<Array<{ systems_covered: bigint }>>`
      SELECT COUNT(DISTINCT sw.id) AS systems_covered
      FROM assignment a
      JOIN system_roles sr ON lower(sr.technical_id) = lower(regexp_replace(a.system_role, '^jira:', ''))
      JOIN softwares sw ON sw.id = sr.software_id
      WHERE upper(coalesce(a.status, '')) = 'ACTIVE'
        AND lower(coalesce(sr.is_current, 'false')) = 'true'
        AND lower(coalesce(sw.is_current, 'false')) = 'true'
    `,
    db.$queryRaw<Array<{ srs_covered: bigint }>>`
      SELECT COUNT(DISTINCT sr.id) AS srs_covered
      FROM assignment a
      JOIN system_roles sr ON lower(sr.technical_id) = lower(regexp_replace(a.system_role, '^jira:', ''))
      JOIN softwares sw ON sw.id = sr.software_id
      WHERE upper(coalesce(a.status, '')) = 'ACTIVE'
        AND lower(coalesce(sr.is_current, 'false')) = 'true'
        AND lower(coalesce(sw.is_current, 'false')) = 'true'
    `,
    db.$queryRaw<Array<{ day_label: string; executions: bigint }>>`
      WITH assignment_base AS (
        SELECT
          COALESCE(NULLIF(created_at, ''), NULLIF(grant_date, ''))::timestamptz AS event_ts,
          NULLIF(btrim(execution_id), '') AS execution_ref
        FROM assignment
        WHERE COALESCE(NULLIF(created_at, ''), NULLIF(grant_date, '')) IS NOT NULL
      ),
      ref AS (
        SELECT COALESCE(MAX(event_ts), now()) AS max_dt
        FROM assignment_base
      ),
      days AS (
        SELECT generate_series(
          date_trunc('day', (SELECT max_dt FROM ref)) - interval '29 days',
          date_trunc('day', (SELECT max_dt FROM ref)),
          interval '1 day'
        )::timestamptz AS day_ref
      ),
      day_exec AS (
        SELECT
          date_trunc('day', event_ts) AS day_ref,
          COUNT(*) AS executions
        FROM assignment_base
        GROUP BY date_trunc('day', event_ts)
      )
      SELECT
        to_char(d.day_ref, 'DD/MM') AS day_label,
        COALESCE(e.executions, 0) AS executions
      FROM days d
      LEFT JOIN day_exec e ON e.day_ref = d.day_ref
      ORDER BY d.day_ref
    `,
    db.$queryRaw<Array<{ system_name: string; accesses: bigint }>>`
      SELECT
        COALESCE(sw.name, split_part(a.system_id, ':', 1)) AS system_name,
        COUNT(*) AS accesses
      FROM assignment a
      JOIN system_roles sr ON lower(sr.technical_id) = lower(regexp_replace(a.system_role, '^jira:', ''))
      JOIN softwares sw ON sw.id = sr.software_id
      WHERE upper(coalesce(a.status, '')) = 'ACTIVE'
        AND lower(coalesce(sr.is_current, 'false')) = 'true'
        AND lower(coalesce(sw.is_current, 'false')) = 'true'
      GROUP BY COALESCE(sw.name, split_part(a.system_id, ':', 1))
      ORDER BY accesses DESC
      LIMIT 12
    `,
  ]));

  const totalBr = Number(totalBrCount[0]?.total_br || 0);
  const activeAreas = Number(activeAreasCount[0]?.total_areas || 0);
  const avgSrPerBr = Number(avgSrPerBrRes[0]?.avg_sr_per_br || 0);
  const brCriteriaEmployees = Number(brCoverageCriteriaSplitRes[0]?.employees || 0);
  const brCriteriaThirdParties = Number(brCoverageCriteriaSplitRes[0]?.third_parties || 0);

  const totalGranted = Number(totalAccessesGranted[0]?.granted || 0);
  const usersWithBr = Number(usersWithBrRes[0]?.users_with_br || 0);
  const employeesCount = Number(workforceSplitRes[0]?.employees || 0);
  const thirdPartiesCount = Number(workforceSplitRes[0]?.third_parties || 0);
  const brCriteriaEmployeesPct = employeesCount > 0 ? (brCriteriaEmployees / employeesCount) * 100 : 0;
  const brCriteriaThirdPartiesPct = thirdPartiesCount > 0 ? (brCriteriaThirdParties / thirdPartiesCount) * 100 : 0;
  const avgAccessPerUser = activeUsersCount > 0 ? totalGranted / activeUsersCount : 0;
  const accessCoverage = activeUsersCount > 0 ? (usersWithBr / activeUsersCount) * 100 : 0;

  const grantedOps = Number(actionStatsRes[0]?.granted || 0);
  const revokedOps = Number(actionStatsRes[0]?.revoked || 0);
  const totalOps = grantedOps + revokedOps;
  const estimatedSavedHours = totalOps * (3 / 60);
  const systemsCovered = Number(systemsCoveredRes[0]?.systems_covered || 0);
  const srsCovered = Number(srCoveredRes[0]?.srs_covered || 0);

  const evolutionData: LinePoint[] = evolutionRes.map((item) => ({
    label: item.month_label,
    brCount: Number(item.br_count),
    areaCoverage: Number(item.area_coverage),
  }));

  const topUsersSr: KV[] = topUsersSrRes.map((item) => ({ label: toFriendlyLabel(item.user_name, "Sem usuario"), value: Number(item.total_srs) }));
  const topAreasSr: KV[] = topAreasRes.map((item) => ({ label: toFriendlyLabel(item.area_name, "Sem area"), value: Number(item.total_srs) }));
  const topBrBars: KV[] = topBrRes.map((item) => ({ label: toFriendlyLabel(item.br_name, "Sem BR"), value: Number(item.users_count) }));
  const accessesBySystem: KV[] = accessBySystemRes.map((item) => ({ label: toFriendlyLabel(item.system_name, "Sem sistema"), value: Number(item.accesses) }));
  const execHistogram: KV[] = execHistogramRes.map((item) => {
    const value = Number(item.executions);
    return {
      label: item.day_label,
      value: Number.isFinite(value) ? value : 0,
    };
  });

  const insights: string[] = [];
  if (accessCoverage < 80) insights.push(`Cobertura de usuarios com BR em ${accessCoverage.toFixed(1)}%. Priorizar usuarios sem vinculacao.`);
  if (avgSrPerBr < 3) insights.push(`Media de SR por BR em ${avgSrPerBr.toFixed(1)}. Revisar granularidade de perfis.`);
  if (revokedOps > grantedOps * 0.4) insights.push("Volume de revogacoes elevado. Pode indicar mudanca recorrente de lotacao/perfil.");
  if (insights.length === 0) insights.push("Cenario estavel: cobertura e distribuicao de acessos em niveis saudaveis.");

  return (
    <AppShell user={user} title="Administracao Vision" description="Dashboard executivo de BRs, users e atuacao do orquestrador.">
      <section className="space-y-4">
        <Card>
          <h3 className="text-lg font-bold text-slate-900">BRs</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard title="Total BR" value={String(totalBr)} hint="BRs ativas" compact />
            <MetricCard title="Areas Ativas" value={String(activeAreas)} hint="Areas com pelo menos 1 pessoa" compact />
            <MetricCard title="Media SR/BR" value={avgSrPerBr.toFixed(1)} hint="Somente SRs ativas" compact />
            <DonutCard title="Cobertura Internos" percentage={brCriteriaEmployeesPct} detail={`${brCriteriaEmployees}/${employeesCount} internos`} compact />
            <DonutCard title="Cobertura Externos" percentage={brCriteriaThirdPartiesPct} detail={`${brCriteriaThirdParties}/${thirdPartiesCount} externos`} compact />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Evolucao BR x Cobertura de Areas</p>
            <LineCompareChart data={evolutionData} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">BRs com mais usuarios</p>
            <table className="min-w-full table-compact">
              <thead>
                <tr className="border-b border-[#f1e6c9] text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">BR</th>
                  <th className="py-1">Users</th>
                  <th className="py-1">SRs</th>
                </tr>
              </thead>
              <tbody>
                {brLeaderboardRes.slice(0, 8).map((row) => (
                  <tr key={row.br_name} className="border-b border-[#f7edd5] text-slate-800">
                    <td className="py-1 pr-2">{toFriendlyLabel(row.br_name, "Sem BR")}</td>
                    <td className="py-1">{Number(row.users_count)}</td>
                    <td className="py-1">{Number(row.sr_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-slate-900">Users</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard title="Total Users" value={String(activeUsersCount)} hint="Apenas ativos" compact center />
            <MetricCard title="Funcionarios" value={String(employeesCount)} hint="Vinculos internos" compact center />
            <MetricCard title="Terceiros" value={String(thirdPartiesCount)} hint="Parceiros e externos" compact center />
            <MetricCard title="Acessos Concedidos" value={String(totalGranted)} hint="Assignments ativos" compact center />
            <MetricCard title="Media Acesso/User" value={avgAccessPerUser.toFixed(2)} hint="Acessos por usuario" compact center />
            <MetricCard title="Cobertura Acessos" value={`${accessCoverage.toFixed(1)}%`} hint={`${usersWithBr}/${activeUsersCount} com BR`} compact center />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Top users com mais SRs</p>
              <BarList items={topUsersSr} />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Top areas com SRs</p>
              <BarList items={topAreasSr} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Users sem acessos</p>
              <ul className="max-h-56 overflow-auto space-y-2 text-base text-slate-700">
                {usersNoAccessRes.length === 0 ? <li className="text-slate-500">Nenhum usuario sem BR.</li> : null}
                {usersNoAccessRes.map((item) => (
                  <li key={item.email} className="rounded-lg bg-slate-50 px-3 py-2">
                    {item.user_name} ({item.email})
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Top 5 BRs</p>
              <BarList items={topBrBars} />
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <Card>
          <h3 className="text-lg font-bold text-slate-900">Atuacao do Orquestrador</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <MetricCard title="Acessos (G/R)" value={`${grantedOps}/${revokedOps}`} hint="Concedidos/Removidos" compact />
            <MetricCard title="Horas Economizadas" value={estimatedSavedHours.toFixed(1)} hint="Estimativa 3 min por acesso" compact />
            <MetricCard title="Sistemas Cobertos" value={String(systemsCovered)} hint="Systems ativos com uso" compact />
            <MetricCard title="SRs Cobertas" value={String(srsCovered)} hint="SRs ativas com uso" compact />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Histograma de execucoes (30 dias)</p>
            <ColumnHistogram items={execHistogram} />
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-slate-900">Acessos por Sistema</h3>
          <BarList items={accessesBySystem} />
        </Card>
      </section>

      <Card>
        <h3 className="text-lg font-bold text-slate-900">Insights</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {insights.map((insight) => (
            <li key={insight} className="rounded-lg bg-rose-50 px-3 py-2">
              {insight}
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}

function MetricCard({
  title,
  value,
  hint,
  compact = false,
  center = false,
}: Readonly<{ title: string; value: string; hint: string; compact?: boolean; center?: boolean }>) {
  return (
    <div className={`${compact ? "rounded-xl border border-rose-100 bg-rose-50/40 p-3" : ""} ${center ? "text-center" : ""}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-rose-700 leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500 leading-tight break-words">{hint}</p>
    </div>
  );
}

function DonutCard({
  title,
  percentage,
  detail,
  compact = false,
}: Readonly<{ title: string; percentage: number; detail: string; compact?: boolean }>) {
  const pct = Math.max(0, Math.min(100, percentage));
  return (
    <div className={`${compact ? "rounded-xl border border-rose-100 bg-rose-50/40 p-3" : ""}`}>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="h-14 w-14 rounded-full"
          style={{ background: `conic-gradient(#e11d48 ${pct}%, #fde2e7 ${pct}% 100%)` }}
          aria-label={`${pct.toFixed(1)}%`}
        >
          <div className="mx-auto mt-2 h-10 w-10 rounded-full bg-white" />
        </div>
        <div>
          <p className="text-xl font-bold text-rose-700">{pct.toFixed(1)}%</p>
          <p className="text-[11px] text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function BarList({ items }: Readonly<{ items: KV[] }>) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.length === 0 ? <p className="text-sm text-slate-500">Sem dados.</p> : null}
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-600">
            <span className="truncate">{item.label}</span>
            <span className="font-semibold text-slate-800">{item.value}</span>
          </div>
          <div className="h-2 rounded bg-rose-100">
            <div className="h-2 rounded bg-rose-500" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ColumnHistogram({ items }: Readonly<{ items: KV[] }>) {
  const normalized = items.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? item.value : 0,
  }));
  const max = Math.max(...normalized.map((i) => i.value), 1);
  const total = normalized.reduce((acc, item) => acc + item.value, 0);
  return (
    <div className="overflow-x-auto rounded-xl border border-rose-100 bg-rose-50/30 p-2">
      {normalized.length === 0 ? <p className="text-sm text-slate-500">Sem dados.</p> : null}
      {normalized.length > 0 ? (
        <div className="mb-2 text-xs text-slate-500">Execucoes totais no periodo: {total}</div>
      ) : null}
      <div className="flex h-36 min-w-[900px] items-stretch gap-2">
        {normalized.map((item) => (
          <div key={item.label} className="flex h-full w-7 flex-col items-center justify-end">
            <div className="w-6 rounded-t bg-rose-500" style={{ height: `${Math.max(6, (item.value / max) * 100)}%` }} title={`${item.label}: ${item.value}`} />
            <span className="mt-1 text-[10px] text-slate-500">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineCompareChart({ data }: Readonly<{ data: LinePoint[] }>) {
  const width = 980;
  const height = 190;
  const padX = 34;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const maxY = Math.max(...data.map((d) => Math.max(d.brCount, d.areaCoverage)), 1);

  const toPoint = (index: number, value: number) => {
    const x = padX + (data.length <= 1 ? 0 : (index / (data.length - 1)) * innerW);
    const y = padY + innerH - (value / maxY) * innerH;
    return `${x},${y}`;
  };

  const brPoints = data.map((d, i) => toPoint(i, d.brCount)).join(" ");
  const areaPoints = data.map((d, i) => toPoint(i, d.areaCoverage)).join(" ");

  return (
    <div className="overflow-x-auto rounded-xl border border-rose-100 bg-rose-50/30 p-2">
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Sem dados.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-48 min-w-[860px] w-full">
          <polyline fill="none" stroke="#e11d48" strokeWidth="3" points={brPoints} />
          <polyline fill="none" stroke="#0f766e" strokeWidth="3" points={areaPoints} />
          {data.map((d, i) => (
            <g key={d.label}>
              <circle cx={toPoint(i, d.brCount).split(",")[0]} cy={toPoint(i, d.brCount).split(",")[1]} r="3" fill="#e11d48" />
              <circle cx={toPoint(i, d.areaCoverage).split(",")[0]} cy={toPoint(i, d.areaCoverage).split(",")[1]} r="3" fill="#0f766e" />
            </g>
          ))}
          <text x="18" y="18" fontSize="11" fill="#e11d48">BRs</text>
          <text x="58" y="18" fontSize="11" fill="#0f766e">Areas cobertas</text>
          {data.map((d, i) => (
            <text key={`label-${d.label}`} x={padX + (data.length <= 1 ? 0 : (i / (data.length - 1)) * innerW)} y={height - 4} fontSize="10" textAnchor="middle" fill="#64748b">
              {d.label}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

