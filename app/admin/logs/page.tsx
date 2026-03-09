import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { LogExportClient } from "@/components/log-export-client";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toPublicLogExportSettings } from "@/lib/log-export-settings";

type SearchParams = Promise<{
  q?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
}>;

function parseDateBoundary(value: string | undefined, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function formatDateTime(date: Date) {
  return date.toLocaleString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderDetails(details: unknown) {
  if (details === null || details === undefined) return "-";
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export default async function AdminLogsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);
  const logExportSettings = await db.logExportSettings.upsert({
    where: { tenantKey: "default" },
    update: {},
    create: {
      tenantKey: "default",
      destination: "SPLUNK_HEC",
      enabled: false,
      splunkSource: "iga-portal",
      splunkSourceType: "iga:audit",
      s3Prefix: "iga-portal/audit",
    },
  });

  const fromDate = parseDateBoundary(params.from);
  const toDate = parseDateBoundary(params.to, true);

  const andFilters: Prisma.AuditLogWhereInput[] = [];
  if (params.q?.trim()) {
    const text = params.q.trim();
    andFilters.push({
      OR: [
        { action: { contains: text, mode: "insensitive" } },
        { entityType: { contains: text, mode: "insensitive" } },
        { entityId: { contains: text, mode: "insensitive" } },
        { actor: { is: { name: { contains: text, mode: "insensitive" } } } },
        { actor: { is: { email: { contains: text, mode: "insensitive" } } } },
      ],
    });
  }
  if (params.action?.trim()) {
    andFilters.push({ action: params.action.trim() });
  }
  if (params.entityType?.trim()) {
    andFilters.push({ entityType: params.entityType.trim() });
  }
  if (params.actorId?.trim()) {
    andFilters.push({ actorId: params.actorId.trim() });
  }
  if (fromDate || toDate) {
    andFilters.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  const where: Prisma.AuditLogWhereInput = andFilters.length > 0 ? { AND: andFilters } : {};

  const [totalLogs, logs, actionOptions, entityTypeOptions, actorOptions] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
      take: 300,
    }),
    db.auditLog.findMany({
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
      take: 300,
    }),
    db.user.findMany({
      where: { active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedLogs =
    safePage === page
      ? logs
      : await db.auditLog.findMany({
          where,
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (safePage - 1) * pageSize,
          take: pageSize,
        });

  return (
    <AppShell user={user} title="Admin - Logs" description="Consulta de logs de auditoria do portal com filtros operacionais.">
      <LogExportClient initialSettings={toPublicLogExportSettings(logExportSettings)} />

      <Card>
        <form className="mb-4 grid gap-3 rounded-xl border border-[#f1e6c9] bg-[#fff8e8]/40 p-3 md:grid-cols-4" method="get">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Buscar por acao, entidade, ID, ator..."
            className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm md:col-span-2"
          />
          <select name="action" defaultValue={params.action || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todas as acoes</option>
            {actionOptions.map((item) => (
              <option key={item.action} value={item.action}>
                {item.action}
              </option>
            ))}
          </select>
          <select name="entityType" defaultValue={params.entityType || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todas as entidades</option>
            {entityTypeOptions.map((item) => (
              <option key={item.entityType} value={item.entityType}>
                {item.entityType}
              </option>
            ))}
          </select>
          <select name="actorId" defaultValue={params.actorId || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todos os atores</option>
            {actorOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.email})
              </option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={params.from || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm" />
          <input type="date" name="to" defaultValue={params.to || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm" />
          <button className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a]">Aplicar filtros</button>
        </form>

        <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
          <span>Total de eventos: {totalLogs}</span>
          <span>Pagina {safePage} de {totalPages}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/30 p-2">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Data/Hora</th>
                <th className="py-2">Acao</th>
                <th className="py-2">Entidade</th>
                <th className="py-2">Entity ID</th>
                <th className="py-2">Ator</th>
                <th className="py-2">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {pagedLogs.map((item) => (
                <tr key={item.id} className="border-b border-[#f7edd5] align-top text-slate-800">
                  <td className="py-2 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-[#f8ecd1] px-2 py-0.5 text-[10px] font-semibold text-[#800020]">{item.action}</span>
                  </td>
                  <td className="py-2">{item.entityType}</td>
                  <td className="py-2 font-mono text-xs">{item.entityId}</td>
                  <td className="py-2">{item.actor ? `${item.actor.name} (${item.actor.email})` : "system"}</td>
                  <td className="py-2">
                    <details>
                      <summary className="cursor-pointer text-sm text-[#800020] hover:underline">Ver JSON</summary>
                      <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
                        {renderDetails(item.details)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagedLogs.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Nenhum evento encontrado com os filtros aplicados.</p> : null}
        </div>

        <PaginationControls
          basePath="/admin/logs"
          page={safePage}
          pageSize={pageSize}
          totalItems={totalLogs}
          query={{
            q: params.q,
            action: params.action,
            entityType: params.entityType,
            actorId: params.actorId,
            from: params.from,
            to: params.to,
          }}
        />
      </Card>
    </AppShell>
  );
}
