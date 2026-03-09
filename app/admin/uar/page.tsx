import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type SummaryRow = {
  reviewed_recently: bigint;
  pending: bigint;
  overdue: bigint;
  upcoming: bigint;
  total_current: bigint;
};

type BrReviewRow = {
  br_name: string | null;
  owner_name: string | null;
  owner_id: string | null;
  last_revision_dt: string | null;
  next_revision_dt: string | null;
};

type DirectReviewRow = {
  user_name: string | null;
  approver_name: string | null;
  system_name: string | null;
  system_role_name: string | null;
  grant_dt: string | null;
  expiration_dt: string | null;
};

type ByResponsibleRow = {
  responsible: string | null;
  total: bigint;
  pending: bigint;
  overdue: bigint;
};

function toNumber(value: bigint | number | null | undefined) {
  return Number(value || 0);
}

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return dateValue;
  return d.toLocaleDateString("pt-BR");
}

function MetricCard({ title, value, hint }: Readonly<{ title: string; value: string; hint: string }>) {
  return (
    <div className="rounded-lg border border-rose-100 bg-rose-50/40 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-xl font-semibold text-rose-700 leading-none">{value}</p>
      <p className="mt-1 text-[10px] text-slate-500 leading-tight">{hint}</p>
    </div>
  );
}

export default async function AdminUarPage() {
  const user = await requirePageUser("ADMIN");

  const [
    brSummaryRes,
    brOverdueRes,
    brUpcomingRes,
    brOwnersRes,
    directSummaryRes,
    directOverdueRes,
    directUpcomingRes,
    directApproversRes,
  ] = await Promise.all([
    db.$queryRaw<SummaryRow[]>`
      WITH br_latest AS (
        SELECT DISTINCT ON (id)
          id,
          NULLIF(last_revision_date, '')::date AS last_revision_dt,
          NULLIF(next_revision_date, '')::date AS next_revision_dt
        FROM business_roles
        WHERE id IS NOT NULL
          AND lower(coalesce(is_current, 'false')) = 'true'
        ORDER BY id, updated_at DESC NULLS LAST, _row_id DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE last_revision_dt >= current_date - interval '30 days') AS reviewed_recently,
        COUNT(*) FILTER (WHERE next_revision_dt BETWEEN current_date AND current_date + interval '30 days') AS pending,
        COUNT(*) FILTER (WHERE next_revision_dt < current_date) AS overdue,
        COUNT(*) FILTER (WHERE next_revision_dt > current_date + interval '30 days') AS upcoming,
        COUNT(*) AS total_current
      FROM br_latest
    `,
    db.$queryRaw<BrReviewRow[]>`
      WITH br_latest AS (
        SELECT DISTINCT ON (id)
          id,
          COALESCE(NULLIF(name, ''), NULLIF(technical_id, ''), id) AS br_name,
          COALESCE(NULLIF(owner, ''), 'Sem owner') AS owner_name,
          owner_id,
          NULLIF(last_revision_date, '')::date AS last_revision_dt,
          NULLIF(next_revision_date, '')::date AS next_revision_dt
        FROM business_roles
        WHERE id IS NOT NULL
          AND lower(coalesce(is_current, 'false')) = 'true'
        ORDER BY id, updated_at DESC NULLS LAST, _row_id DESC
      )
      SELECT
        br_name,
        owner_name,
        owner_id,
        to_char(last_revision_dt, 'YYYY-MM-DD') AS last_revision_dt,
        to_char(next_revision_dt, 'YYYY-MM-DD') AS next_revision_dt
      FROM br_latest
      WHERE next_revision_dt < current_date
      ORDER BY next_revision_dt ASC NULLS FIRST, br_name ASC
      LIMIT 12
    `,
    db.$queryRaw<BrReviewRow[]>`
      WITH br_latest AS (
        SELECT DISTINCT ON (id)
          id,
          COALESCE(NULLIF(name, ''), NULLIF(technical_id, ''), id) AS br_name,
          COALESCE(NULLIF(owner, ''), 'Sem owner') AS owner_name,
          owner_id,
          NULLIF(last_revision_date, '')::date AS last_revision_dt,
          NULLIF(next_revision_date, '')::date AS next_revision_dt
        FROM business_roles
        WHERE id IS NOT NULL
          AND lower(coalesce(is_current, 'false')) = 'true'
        ORDER BY id, updated_at DESC NULLS LAST, _row_id DESC
      )
      SELECT
        br_name,
        owner_name,
        owner_id,
        to_char(last_revision_dt, 'YYYY-MM-DD') AS last_revision_dt,
        to_char(next_revision_dt, 'YYYY-MM-DD') AS next_revision_dt
      FROM br_latest
      WHERE next_revision_dt >= current_date
      ORDER BY next_revision_dt ASC NULLS LAST, br_name ASC
      LIMIT 12
    `,
    db.$queryRaw<ByResponsibleRow[]>`
      WITH br_latest AS (
        SELECT DISTINCT ON (id)
          COALESCE(NULLIF(owner, ''), owner_id, 'Sem owner') AS responsible,
          NULLIF(next_revision_date, '')::date AS next_revision_dt
        FROM business_roles
        WHERE id IS NOT NULL
          AND lower(coalesce(is_current, 'false')) = 'true'
        ORDER BY id, updated_at DESC NULLS LAST, _row_id DESC
      )
      SELECT
        responsible,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE next_revision_dt BETWEEN current_date AND current_date + interval '30 days') AS pending,
        COUNT(*) FILTER (WHERE next_revision_dt < current_date) AS overdue
      FROM br_latest
      GROUP BY responsible
      ORDER BY overdue DESC, pending DESC, total DESC
      LIMIT 10
    `,
    db.$queryRaw<SummaryRow[]>`
      WITH direct_base AS (
        SELECT
          COALESCE(NULLIF(id, ''), md5(coalesce(user_id, '') || ':' || coalesce(system_role, '') || ':' || coalesce(system_id, ''))) AS access_key,
          COALESCE(NULLIF(user_name, ''), split_part(user_id, ':', 1)) AS user_name,
          COALESCE(NULLIF(approver, ''), 'Sem aprovador') AS approver_name,
          COALESCE(NULLIF(system, ''), split_part(system_id, ':', 1)) AS system_name,
          COALESCE(NULLIF(system_role, ''), 'Sem SR') AS system_role_name,
          NULLIF(grant_date, '')::date AS grant_dt,
          NULLIF(expiration_date, '')::date AS expiration_dt,
          NULLIF(created_at, '')::timestamptz AS created_ts,
          _row_id
        FROM assignment
        WHERE upper(coalesce(status, '')) = 'ACTIVE'
          AND upper(coalesce(grant_origin, '')) <> 'BUSINESS_ROLE'
      ),
      direct_latest AS (
        SELECT DISTINCT ON (access_key)
          access_key,
          user_name,
          approver_name,
          system_name,
          system_role_name,
          grant_dt,
          expiration_dt,
          created_ts
        FROM direct_base
        ORDER BY access_key, created_ts DESC NULLS LAST, _row_id DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE grant_dt >= current_date - interval '30 days') AS reviewed_recently,
        COUNT(*) FILTER (WHERE expiration_dt BETWEEN current_date AND current_date + interval '30 days') AS pending,
        COUNT(*) FILTER (WHERE expiration_dt < current_date) AS overdue,
        COUNT(*) FILTER (WHERE expiration_dt > current_date + interval '30 days') AS upcoming,
        COUNT(*) AS total_current
      FROM direct_latest
    `,
    db.$queryRaw<DirectReviewRow[]>`
      WITH direct_base AS (
        SELECT
          COALESCE(NULLIF(id, ''), md5(coalesce(user_id, '') || ':' || coalesce(system_role, '') || ':' || coalesce(system_id, ''))) AS access_key,
          COALESCE(NULLIF(user_name, ''), split_part(user_id, ':', 1)) AS user_name,
          COALESCE(NULLIF(approver, ''), 'Sem aprovador') AS approver_name,
          COALESCE(NULLIF(system, ''), split_part(system_id, ':', 1)) AS system_name,
          COALESCE(NULLIF(system_role, ''), 'Sem SR') AS system_role_name,
          NULLIF(grant_date, '')::date AS grant_dt,
          NULLIF(expiration_date, '')::date AS expiration_dt,
          NULLIF(created_at, '')::timestamptz AS created_ts,
          _row_id
        FROM assignment
        WHERE upper(coalesce(status, '')) = 'ACTIVE'
          AND upper(coalesce(grant_origin, '')) <> 'BUSINESS_ROLE'
      ),
      direct_latest AS (
        SELECT DISTINCT ON (access_key)
          access_key,
          user_name,
          approver_name,
          system_name,
          system_role_name,
          grant_dt,
          expiration_dt,
          created_ts
        FROM direct_base
        ORDER BY access_key, created_ts DESC NULLS LAST, _row_id DESC
      )
      SELECT
        user_name,
        approver_name,
        system_name,
        system_role_name,
        to_char(grant_dt, 'YYYY-MM-DD') AS grant_dt,
        to_char(expiration_dt, 'YYYY-MM-DD') AS expiration_dt
      FROM direct_latest
      WHERE expiration_dt < current_date
      ORDER BY expiration_dt ASC NULLS FIRST, user_name ASC
      LIMIT 12
    `,
    db.$queryRaw<DirectReviewRow[]>`
      WITH direct_base AS (
        SELECT
          COALESCE(NULLIF(id, ''), md5(coalesce(user_id, '') || ':' || coalesce(system_role, '') || ':' || coalesce(system_id, ''))) AS access_key,
          COALESCE(NULLIF(user_name, ''), split_part(user_id, ':', 1)) AS user_name,
          COALESCE(NULLIF(approver, ''), 'Sem aprovador') AS approver_name,
          COALESCE(NULLIF(system, ''), split_part(system_id, ':', 1)) AS system_name,
          COALESCE(NULLIF(system_role, ''), 'Sem SR') AS system_role_name,
          NULLIF(grant_date, '')::date AS grant_dt,
          NULLIF(expiration_date, '')::date AS expiration_dt,
          NULLIF(created_at, '')::timestamptz AS created_ts,
          _row_id
        FROM assignment
        WHERE upper(coalesce(status, '')) = 'ACTIVE'
          AND upper(coalesce(grant_origin, '')) <> 'BUSINESS_ROLE'
      ),
      direct_latest AS (
        SELECT DISTINCT ON (access_key)
          access_key,
          user_name,
          approver_name,
          system_name,
          system_role_name,
          grant_dt,
          expiration_dt,
          created_ts
        FROM direct_base
        ORDER BY access_key, created_ts DESC NULLS LAST, _row_id DESC
      )
      SELECT
        user_name,
        approver_name,
        system_name,
        system_role_name,
        to_char(grant_dt, 'YYYY-MM-DD') AS grant_dt,
        to_char(expiration_dt, 'YYYY-MM-DD') AS expiration_dt
      FROM direct_latest
      WHERE expiration_dt >= current_date
      ORDER BY expiration_dt ASC NULLS LAST, user_name ASC
      LIMIT 12
    `,
    db.$queryRaw<ByResponsibleRow[]>`
      WITH direct_base AS (
        SELECT
          COALESCE(NULLIF(id, ''), md5(coalesce(user_id, '') || ':' || coalesce(system_role, '') || ':' || coalesce(system_id, ''))) AS access_key,
          COALESCE(NULLIF(approver, ''), 'Sem aprovador') AS responsible,
          NULLIF(expiration_date, '')::date AS expiration_dt,
          NULLIF(created_at, '')::timestamptz AS created_ts,
          _row_id
        FROM assignment
        WHERE upper(coalesce(status, '')) = 'ACTIVE'
          AND upper(coalesce(grant_origin, '')) <> 'BUSINESS_ROLE'
      ),
      direct_latest AS (
        SELECT DISTINCT ON (access_key)
          access_key,
          responsible,
          expiration_dt,
          created_ts
        FROM direct_base
        ORDER BY access_key, created_ts DESC NULLS LAST, _row_id DESC
      )
      SELECT
        responsible,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE expiration_dt BETWEEN current_date AND current_date + interval '30 days') AS pending,
        COUNT(*) FILTER (WHERE expiration_dt < current_date) AS overdue
      FROM direct_latest
      GROUP BY responsible
      ORDER BY overdue DESC, pending DESC, total DESC
      LIMIT 10
    `,
  ]);

  const brSummary = brSummaryRes[0];
  const directSummary = directSummaryRes[0];

  return (
    <AppShell
      user={user}
      title="Admin - UAR"
      description="Campanha de revisao de acessos (UAR) para BRs e acessos diretos."
    >

      <Card className="mb-3 bg-amber-50 p-3">
        <p className="text-xs text-slate-700">
          Regra de governanca: acesso sem revisao e renovacao dentro do prazo deve ser revogado.
          Esta visao destaca pendencias e atrasos para acao dos owners e aprovadores responsaveis.
        </p>
      </Card>

      <section className="space-y-3">
        <Card className="p-4">
          <h3 className="text-base font-semibold text-slate-900">Revisao de BRs</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Total BRs" value={String(toNumber(brSummary?.total_current))} hint="BRs atuais na base" />
            <MetricCard title="Revisadas (30d)" value={String(toNumber(brSummary?.reviewed_recently))} hint="Ultimos 30 dias" />
            <MetricCard title="Pendentes (30d)" value={String(toNumber(brSummary?.pending))} hint="Vencem nos proximos 30 dias" />
            <MetricCard title="Atrasadas" value={String(toNumber(brSummary?.overdue))} hint="Data de revisao vencida" />
            <MetricCard title="Proximas" value={String(toNumber(brSummary?.upcoming))} hint="Revisao apos 30 dias" />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">BRs com revisao atrasada</p>
              <div className="overflow-x-auto rounded-xl border border-rose-100 bg-rose-50/40 p-2">
                <table className="min-w-full table-compact">
                  <thead>
                    <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-1 pr-2">BR</th>
                      <th className="py-1 pr-2">Owner</th>
                      <th className="py-1 pr-2">Ultima</th>
                      <th className="py-1">Proxima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brOverdueRes.map((row, index) => (
                      <tr key={`${row.br_name}-${index}`} className="border-b border-[#f7edd5] text-slate-800">
                        <td className="py-1 pr-2">{toFriendlyLabel(row.br_name, "Sem BR")}</td>
                        <td className="py-1">{toFriendlyLabel(row.owner_name, "Sem owner")}</td>
                        <td className="py-1">{formatDate(row.last_revision_dt)}</td>
                        <td className="py-1">{formatDate(row.next_revision_dt)}</td>
                      </tr>
                    ))}
                    {brOverdueRes.length === 0 ? (
                      <tr>
                        <td className="py-2 text-slate-500" colSpan={4}>Nenhuma BR atrasada.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Proximas BRs a revisar</p>
              <div className="overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/40 p-2">
                <table className="min-w-full table-compact">
                  <thead>
                    <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-1 pr-2">BR</th>
                      <th className="py-1 pr-2">Owner</th>
                      <th className="py-1">Proxima revisao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brUpcomingRes.map((row, index) => (
                      <tr key={`${row.br_name}-${index}`} className="border-b border-[#f7edd5] text-slate-800">
                        <td className="py-1 pr-2">{toFriendlyLabel(row.br_name, "Sem BR")}</td>
                        <td className="py-1">{toFriendlyLabel(row.owner_name, "Sem owner")}</td>
                        <td className="py-1">{formatDate(row.next_revision_dt)}</td>
                      </tr>
                    ))}
                    {brUpcomingRes.length === 0 ? (
                      <tr>
                        <td className="py-2 text-slate-500" colSpan={3}>Nenhuma BR com revisao futura.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Owners com maior backlog</p>
            <div className="overflow-x-auto rounded-xl border border-violet-100 bg-violet-50/30 p-2">
              <table className="min-w-full table-compact">
                <thead>
                  <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="py-1 pr-2">Owner</th>
                    <th className="py-1 pr-2">Total</th>
                    <th className="py-1 pr-2">Pendentes</th>
                    <th className="py-1">Atrasadas</th>
                  </tr>
                </thead>
                <tbody>
                  {brOwnersRes.map((row, index) => (
                    <tr key={`${row.responsible}-${index}`} className="border-b border-[#f7edd5] text-slate-800">
                      <td className="py-1">{toFriendlyLabel(row.responsible, "Sem owner")}</td>
                      <td className="py-1">{toNumber(row.total)}</td>
                      <td className="py-1">{toNumber(row.pending)}</td>
                      <td className="py-1">{toNumber(row.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-base font-semibold text-slate-900">Revisao de Acessos Diretos</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Total Acessos" value={String(toNumber(directSummary?.total_current))} hint="Acessos DIRECT ativos" />
            <MetricCard title="Renovados (30d)" value={String(toNumber(directSummary?.reviewed_recently))} hint="Concedidos/revisados recentes" />
            <MetricCard title="Pendentes (30d)" value={String(toNumber(directSummary?.pending))} hint="Expiram nos proximos 30 dias" />
            <MetricCard title="Atrasados" value={String(toNumber(directSummary?.overdue))} hint="Expirados e ainda ativos" />
            <MetricCard title="Proximos" value={String(toNumber(directSummary?.upcoming))} hint="Com revisao mais a frente" />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Acessos diretos atrasados</p>
              <div className="overflow-x-auto rounded-xl border border-amber-100 bg-amber-50/40 p-2">
                <table className="min-w-full table-compact">
                  <thead>
                    <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-1 pr-2">Usuario</th>
                      <th className="py-1 pr-2">Aprovador</th>
                      <th className="py-1 pr-2">Acesso</th>
                      <th className="py-1">Expiracao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directOverdueRes.map((row, index) => (
                      <tr key={`${row.user_name}-${row.system_role_name}-${index}`} className="border-b border-[#f7edd5] text-slate-800">
                        <td className="py-1">{toFriendlyLabel(row.user_name, "Sem usuario")}</td>
                        <td className="py-1">{toFriendlyLabel(row.approver_name, "Sem aprovador")}</td>
                        <td className="py-1">{toFriendlyLabel(row.system_name, "Sem sistema")} - {toFriendlyLabel(row.system_role_name, "Sem SR")}</td>
                        <td className="py-1">{formatDate(row.expiration_dt)}</td>
                      </tr>
                    ))}
                    {directOverdueRes.length === 0 ? (
                      <tr>
                        <td className="py-2 text-slate-500" colSpan={4}>Nenhum acesso direto atrasado.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Proximos acessos diretos a revisar</p>
              <div className="overflow-x-auto rounded-xl border border-emerald-100 bg-emerald-50/35 p-2">
                <table className="min-w-full table-compact">
                  <thead>
                    <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="py-1 pr-2">Usuario</th>
                      <th className="py-1 pr-2">Aprovador</th>
                      <th className="py-1 pr-2">Acesso</th>
                      <th className="py-1">Expiracao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directUpcomingRes.map((row, index) => (
                      <tr key={`${row.user_name}-${row.system_role_name}-${index}`} className="border-b border-[#f7edd5] text-slate-800">
                        <td className="py-1">{toFriendlyLabel(row.user_name, "Sem usuario")}</td>
                        <td className="py-1">{toFriendlyLabel(row.approver_name, "Sem aprovador")}</td>
                        <td className="py-1">{toFriendlyLabel(row.system_name, "Sem sistema")} - {toFriendlyLabel(row.system_role_name, "Sem SR")}</td>
                        <td className="py-1">{formatDate(row.expiration_dt)}</td>
                      </tr>
                    ))}
                    {directUpcomingRes.length === 0 ? (
                      <tr>
                        <td className="py-2 text-slate-500" colSpan={4}>Nenhum acesso direto com revisao futura.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-slate-500">Aprovadores com maior backlog</p>
            <div className="overflow-x-auto rounded-xl border border-indigo-100 bg-indigo-50/30 p-2">
              <table className="min-w-full table-compact">
                <thead>
                  <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="py-1 pr-2">Aprovador</th>
                    <th className="py-1 pr-2">Total</th>
                    <th className="py-1 pr-2">Pendentes</th>
                    <th className="py-1">Atrasados</th>
                  </tr>
                </thead>
                <tbody>
                  {directApproversRes.map((row, index) => (
                    <tr key={`${row.responsible}-${index}`} className="border-b border-[#f7edd5] text-slate-800">
                      <td className="py-1">{toFriendlyLabel(row.responsible, "Sem aprovador")}</td>
                      <td className="py-1">{toNumber(row.total)}</td>
                      <td className="py-1">{toNumber(row.pending)}</td>
                      <td className="py-1">{toNumber(row.overdue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

