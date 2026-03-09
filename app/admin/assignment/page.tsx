import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type SearchParams = Promise<{ q?: string; status?: string; action?: string; source?: string; page?: string; pageSize?: string }>;

export default async function AdminAssignmentPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);

  const where: Prisma.OrchestratorAssignmentWhereInput = {};
  if (params.q) {
    where.OR = [
      { id: { contains: params.q, mode: "insensitive" } },
      { userId: { contains: params.q, mode: "insensitive" } },
      { userName: { contains: params.q, mode: "insensitive" } },
      { businessRole: { contains: params.q, mode: "insensitive" } },
      { system: { contains: params.q, mode: "insensitive" } },
      { systemRole: { contains: params.q, mode: "insensitive" } },
      { ticket: { contains: params.q, mode: "insensitive" } },
      { executionId: { contains: params.q, mode: "insensitive" } },
    ];
  }

  if (params.status) where.status = params.status;
  if (params.action) where.action = params.action;
  if (params.source) where.sourceProcess = params.source;

  const totalRows = await db.orchestratorAssignment.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);

  const rows = await db.orchestratorAssignment.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { rowId: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  return (
    <AppShell user={user} title="Admin - Assignment" description="Consulta de atribuicoes/processamentos do orquestrador.">
      <Card>
        <form className="mb-4 grid gap-3 rounded-xl border border-[#f1e6c9] bg-[#fff8e8]/40 p-3 md:grid-cols-6" method="get">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Buscar por user, role, system, ticket"
            className="md:col-span-2 rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={params.status || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todos status</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING_ERROR">PENDING_ERROR</option>
            <option value="PendingError">PendingError</option>
          </select>
          <select name="action" defaultValue={params.action || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todas actions</option>
            <option value="GRANT">GRANT</option>
            <option value="REVOKE">REVOKE</option>
          </select>
          <input
            name="source"
            defaultValue={params.source || ""}
            placeholder="Source process"
            className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a]">Filtrar</button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/30 p-2">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Created At</th>
                <th className="py-2">Action</th>
                <th className="py-2">Status</th>
                <th className="py-2">User</th>
                <th className="py-2">System</th>
                <th className="py-2">System Role</th>
                <th className="py-2">Business Role</th>
                <th className="py-2">Source</th>
                <th className="py-2 min-w-[180px]">Ticket</th>
                <th className="py-2">Execution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.rowId} className="border-b border-[#f7edd5] text-slate-800">
                  <td className="py-2 whitespace-nowrap text-[11px]">{formatCreatedAt(item.createdAt)}</td>
                  <td className="py-2">
                    <ActionBadge action={item.action} />
                  </td>
                  <td className="py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="py-2">{toFriendlyLabel(item.userName, "-")}</td>
                  <td className="py-2">{toFriendlyLabel(beforeColon(item.system), "-")}</td>
                  <td className="py-2">{toFriendlyLabel(afterColon(item.systemRole), "-")}</td>
                  <td className="py-2">{toFriendlyLabel(afterColon(item.businessRole), "-")}</td>
                  <td className="py-2">{item.sourceProcess || "-"}</td>
                  <td className="py-2 min-w-[180px] whitespace-nowrap font-mono text-[11px]">{item.ticket || "-"}</td>
                  <td className="py-2 font-mono text-[11px]">{item.executionId || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/admin/assignment"
          page={safePage}
          pageSize={pageSize}
          totalItems={totalRows}
          query={{ q: params.q, status: params.status, action: params.action, source: params.source }}
        />
      </Card>
    </AppShell>
  );
}

function formatCreatedAt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function beforeColon(value: string | null) {
  if (!value) return "-";
  const [left] = value.split(":");
  return (left || "-").trim();
}

function afterColon(value: string | null) {
  if (!value) return "-";
  const parts = value.split(":");
  if (parts.length < 2) return value.trim();
  return parts.slice(1).join(":").trim() || "-";
}

function StatusBadge({ status }: Readonly<{ status: string | null }>) {
  const normalized = (status || "").toUpperCase();
  if (normalized === "ACTIVE") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">ACTIVE</span>;
  }
  if (normalized === "PENDING_ERROR" || normalized === "PENDINGERROR") {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">PENDING_ERROR</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{status || "-"}</span>;
}

function ActionBadge({ action }: Readonly<{ action: string | null }>) {
  const normalized = (action || "").toUpperCase();
  if (normalized === "GRANT") {
    return <span className="rounded-full bg-[#f8ecd1] px-2 py-0.5 text-[10px] font-semibold text-[#800020]">GRANT</span>;
  }
  if (normalized === "REVOKE") {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">REVOKE</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{action || "-"}</span>;
}


