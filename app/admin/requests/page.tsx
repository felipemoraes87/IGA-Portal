import { AccessRequestStatus, Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";

type SearchParams = Promise<{ status?: string; system?: string; page?: string; pageSize?: string }>;

export default async function AdminRequestsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);
  const validStatuses: AccessRequestStatus[] = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "RUNNING", "SUCCESS", "FAILED"];

  const where: Prisma.AccessRequestWhereInput = {};
  if (params.status && validStatuses.includes(params.status as AccessRequestStatus)) {
    where.status = params.status as AccessRequestStatus;
  }
  if (params.system) where.permission = { system: { name: params.system } };

  const totalRequests = await db.accessRequest.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize));
  const safePage = Math.min(page, totalPages);

  const [requests, systems] = await Promise.all([
    db.accessRequest.findMany({
      where,
      include: {
        requester: true,
        targetUser: true,
        permission: { include: { system: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
    db.system.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell user={user} title="Admin - Requests" description="Consulta administrativa de solicitacoes da plataforma.">
      <Card>
        <h3 className="text-base font-semibold text-slate-900">Solicitacoes</h3>
        <form className="mt-3 grid gap-3 rounded-xl border border-[#f1e6c9] bg-[#fff8e8]/40 p-3 md:grid-cols-3" method="get">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <select name="status" defaultValue={params.status || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todos os status</option>
            <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
            <option value="RUNNING">RUNNING</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <select name="system" defaultValue={params.system || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todos os sistemas</option>
            {systems.map((system) => (
              <option key={system.id} value={system.name}>
                {system.name}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a]">Aplicar filtros</button>
        </form>

        <div className="mt-4 overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/30 p-2">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-2">ID</th>
                <th className="py-2">Solicitante</th>
                <th className="py-2">Usuario Alvo</th>
                <th className="py-2">Sistema</th>
                <th className="py-2">Permissao</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((item) => (
                <tr key={item.id} className="border-b border-[#f7edd5] text-slate-800">
                  <td className="py-2 font-mono text-xs">{item.id.slice(0, 10)}</td>
                  <td className="py-2">{item.requester.email}</td>
                  <td className="py-2">{item.targetUser.email}</td>
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <img src={resolveSystemThumb(item.permission.system.name)} alt={`${item.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                      {item.permission.system.name}
                    </span>
                  </td>
                  <td className="py-2">{item.permission.name}</td>
                  <td className="py-2">
                    <RequestStatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/admin/requests"
          page={safePage}
          pageSize={pageSize}
          totalItems={totalRequests}
          query={{ status: params.status, system: params.system }}
        />
      </Card>
    </AppShell>
  );
}

function RequestStatusBadge({ status }: Readonly<{ status: AccessRequestStatus }>) {
  const tones: Record<AccessRequestStatus, string> = {
    PENDING_APPROVAL: "bg-amber-100 text-amber-700",
    APPROVED: "bg-[#f8ecd1] text-[#800020]",
    REJECTED: "bg-slate-200 text-slate-700",
    RUNNING: "bg-indigo-100 text-indigo-700",
    SUCCESS: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-rose-100 text-rose-700",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[status]}`}>{status}</span>;
}


