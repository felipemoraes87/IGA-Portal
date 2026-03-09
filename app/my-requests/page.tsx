import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";
import { formatDate } from "@/lib/utils";

type SearchParams = Promise<{ page?: string; pageSize?: string; q?: string; status?: string; selected?: string }>;

function renderStatus(status: string) {
  if (status === "PENDING_APPROVAL") {
    return (
      <span className="vision-status vision-status-pending">
        <span className="vision-status-dot bg-amber-500" />
        PENDING_APPROVAL
      </span>
    );
  }
  if (status === "RUNNING") {
    return (
      <span className="vision-status vision-status-running">
        <span className="vision-status-dot bg-[#008080]" />
        RUNNING
      </span>
    );
  }
  if (status === "APPROVED" || status === "EXECUTED") {
    return (
      <span className="vision-status vision-status-done">
        <span className="vision-status-dot bg-emerald-500" />
        CONCLUIDO
      </span>
    );
  }
  return (
    <span className="vision-status vision-status-failed">
      <span className="vision-status-dot bg-red-500" />
      FALHA
    </span>
  );
}

export default async function MyRequestsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("USER");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);
  const q = (params.q || "").trim();
  const status = (params.status || "").trim();
  const selectedId = (params.selected || "").trim();

  const where = {
    requesterId: user.id,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" as const } },
            { permission: { name: { contains: q, mode: "insensitive" as const } } },
            { permission: { system: { name: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const totalRequests = await db.accessRequest.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRequests / pageSize));
  const safePage = Math.min(page, totalPages);

  const requests = await db.accessRequest.findMany({
    where,
    include: {
      permission: { include: { system: true } },
      execution: true,
    },
    orderBy: { createdAt: "desc" },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  const selected = requests.find((item) => item.id === selectedId) ?? requests[0];

  function buildRowHref(requestId: string) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status) search.set("status", status);
    search.set("page", String(safePage));
    search.set("pageSize", String(pageSize));
    search.set("selected", requestId);
    return `/my-requests?${search.toString()}`;
  }

  return (
    <AppShell user={user} title="Minhas Solicitacoes" description="Gerencie e acompanhe o status das requisicoes de acesso.">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-[#800020]">
          Home
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">Minhas Solicitacoes</span>
      </nav>

      <Card className="border-slate-200 p-4">
        <form method="get" className="grid gap-3 md:grid-cols-4">
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <input type="hidden" name="page" value="1" />
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pesquisar ID ou Sistema</label>
            <input
              name="q"
              defaultValue={q}
              placeholder="Ex: REQ-8291"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#800020] focus:outline-none focus:ring-2 focus:ring-[#800020]/10"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Status</label>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-[#800020] focus:outline-none focus:ring-2 focus:ring-[#800020]/10"
            >
              <option value="">Todos os status</option>
              <option value="PENDING_APPROVAL">Pendente</option>
              <option value="RUNNING">Em Processamento</option>
              <option value="APPROVED">Concluido</option>
              <option value="FAILED">Falha</option>
              <option value="REJECTED">Rejeitado</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200">
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Historico de solicitacoes</h3>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{totalRequests} registros</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-compact">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th>ID Solicitação</th>
                  <th>Sistema / Perfil</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th className="text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 text-slate-800 transition hover:bg-slate-50/70 ${selected?.id === item.id ? "bg-[#800020]/5" : ""}`}
                  >
                    <td className="font-semibold text-[#800020]">
                      <Link href={buildRowHref(item.id)} className="block py-1">
                        #{item.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <Link href={buildRowHref(item.id)} className="block py-1">
                        <span className="flex flex-col">
                          <span className="flex items-center gap-2 font-semibold text-slate-900">
                            <img src={resolveSystemThumb(item.permission.system.name)} alt={`${item.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                            {item.permission.system.name}
                          </span>
                          <span className="text-xs text-slate-500">{item.permission.name}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Link href={buildRowHref(item.id)} className="block py-1">
                        {renderStatus(item.status)}
                      </Link>
                    </td>
                    <td>
                      <Link href={buildRowHref(item.id)} className="block py-1">
                        {formatDate(item.createdAt)}
                      </Link>
                    </td>
                    <td className="text-right">
                      <Link href={`/requests/${item.id}`} className="text-sm font-bold text-[#800020] hover:underline">
                        Ver Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls basePath="/my-requests" page={safePage} pageSize={pageSize} totalItems={totalRequests} query={{ q, status }} />
            {requests.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhuma solicitacao encontrada.</p> : null}
          </div>
        </Card>

        <Card className="border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Fluxo da Solicitação</h3>
          {selected ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Selecionada</p>
                <p className="mt-1 text-sm font-bold text-[#800020]">#{selected.id.slice(0, 8)}</p>
                <p className="flex items-center gap-2 text-sm text-slate-700">
                  <img src={resolveSystemThumb(selected.permission.system.name)} alt={`${selected.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                  {selected.permission.system.name}
                </p>
                <p className="text-xs text-slate-500">{selected.permission.name}</p>
              </div>

              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">1</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Solicitação criada</p>
                    <p className="text-xs text-slate-500">{formatDate(selected.createdAt)}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">2</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Aprovação gerencial</p>
                    <p className="text-xs text-slate-500">{selected.status === "PENDING_APPROVAL" ? "Aguardando decisão" : "Etapa processada"}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">3</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Execução automática</p>
                    <p className="text-xs text-slate-500">{selected.execution ? "Orquestração registrada" : "Ainda não iniciada"}</p>
                  </div>
                </li>
              </ol>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Selecione uma solicitação para ver o fluxo.</p>
          )}
        </Card>
      </section>
    </AppShell>
  );
}
