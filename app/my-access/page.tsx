import { Prisma } from "@prisma/client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";
import { formatDate, toFriendlyLabel } from "@/lib/utils";

type SearchParams = Promise<{ q?: string; page?: string; pageSize?: string; system?: string; source?: string; criticality?: string }>;

function badgeCriticality(level: "ALTA" | "MEDIA" | "BAIXA") {
  if (level === "ALTA") return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">ALTA</span>;
  if (level === "MEDIA") return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-600">MEDIA</span>;
  return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-600">BAIXA</span>;
}

function guessCriticality(permissionName: string): "ALTA" | "MEDIA" | "BAIXA" {
  const normalized = permissionName.toLowerCase();
  if (normalized.includes("admin") || normalized.includes("owner") || normalized.includes("root")) return "ALTA";
  if (normalized.includes("manager") || normalized.includes("power") || normalized.includes("write")) return "MEDIA";
  return "BAIXA";
}

function formatAssignmentSource(source: string) {
  return source === "BR" ? "BR" : "Adicional";
}

function addMonths(base: Date, months: number) {
  const result = new Date(base);
  result.setMonth(result.getMonth() + months);
  return result;
}

export default async function MyAccessPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("USER");
  const params = await searchParams;
  const q = (params.q || "").trim();
  const systemFilter = (params.system || "").trim();
  const sourceFilter = (params.source || "").trim();
  const criticalityFilter = (params.criticality || "").trim() as "" | "ALTA" | "MEDIA" | "BAIXA";
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);

  const assignmentsWhere: Prisma.UserPermissionAssignmentWhereInput = { userId: user.id };
  if (q) {
    assignmentsWhere.OR = [
      { permission: { name: { contains: q, mode: "insensitive" } } },
      { permission: { system: { name: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (sourceFilter) assignmentsWhere.source = sourceFilter as Prisma.UserPermissionAssignmentWhereInput["source"];

  const totalAssignmentsRaw = await db.userPermissionAssignment.findMany({
    where: assignmentsWhere,
    include: { permission: { include: { system: true } } },
    orderBy: { createdAt: "desc" },
  });

  const directPermissionIds = Array.from(
    new Set(totalAssignmentsRaw.filter((item) => item.source === "DIRECT").map((item) => item.permissionId)),
  );

  const directRequests =
    directPermissionIds.length > 0
      ? await db.accessRequest.findMany({
          where: {
            targetUserId: user.id,
            permissionId: { in: directPermissionIds },
            status: { in: ["APPROVED", "RUNNING", "SUCCESS"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, permissionId: true, createdAt: true },
        })
      : [];

  const requestIds = directRequests.map((item) => item.id);
  const requestAuditRows =
    requestIds.length > 0
      ? await db.auditLog.findMany({
          where: {
            entityType: "AccessRequest",
            entityId: { in: requestIds },
            action: { in: ["REQUEST_CREATED", "REQUEST_CREATED_MIRROR"] },
          },
          orderBy: { createdAt: "desc" },
          select: { entityId: true, details: true },
        })
      : [];

  const durationByRequestId = new Map<string, number>();
  for (const row of requestAuditRows) {
    const details = row.details;
    if (!details || Array.isArray(details) || typeof details !== "object") continue;
    const durationValue = (details as Record<string, unknown>).accessDurationMonths;
    if (typeof durationValue === "number" && [1, 3, 6, 12].includes(durationValue)) {
      durationByRequestId.set(row.entityId, durationValue);
    }
  }

  const latestRequestByPermissionId = new Map<string, { requestCreatedAt: Date; durationMonths: number }>();
  for (const req of directRequests) {
    if (latestRequestByPermissionId.has(req.permissionId)) continue;
    const durationMonths = durationByRequestId.get(req.id);
    if (!durationMonths) continue;
    latestRequestByPermissionId.set(req.permissionId, {
      requestCreatedAt: req.createdAt,
      durationMonths,
    });
  }

  const allSystems = Array.from(new Set(totalAssignmentsRaw.map((item) => item.permission.system.name))).sort((a, b) => a.localeCompare(b));

  const totalAssignmentsFiltered = totalAssignmentsRaw.filter((item) => {
    if (systemFilter && item.permission.system.name !== systemFilter) return false;
    if (criticalityFilter && guessCriticality(item.permission.name) !== criticalityFilter) return false;
    return true;
  });

  const totalAssignments = totalAssignmentsFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalAssignments / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const assignments = totalAssignmentsFiltered.slice(start, start + pageSize);

  return (
    <AppShell user={user} title="Meus Acessos" description="Visao consolidada de permissoes ativas da sua identidade.">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-[#800020]">
          Home
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">Meus Acessos</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Meus Acessos</h2>
          <p className="mt-1 text-slate-500">
            Voce possui <span className="font-semibold text-[#800020]">{totalAssignments}</span> permissoes ativas vinculadas a sua identidade.
          </p>
        </div>
        <Link
          href="/request/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#800020] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#800020]/20 transition hover:bg-[#68001a]"
        >
          Solicitar Novo Acesso
        </Link>
      </div>

      <Card className="border-slate-200 p-4">
        <form method="get" className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Busca Rapida</label>
            <input name="q" defaultValue={q} placeholder="Nome do acesso..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Sistema</label>
            <select name="system" defaultValue={systemFilter} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Todos os Sistemas</option>
              {allSystems.map((systemName) => (
                <option key={systemName} value={systemName}>
                  {systemName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Origem</label>
            <select name="source" defaultValue={sourceFilter} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Todas as Origens</option>
              <option value="DIRECT">Solicitacao Manual</option>
              <option value="BR">Heranca BR</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Criticidade</label>
            <select name="criticality" defaultValue={criticalityFilter} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Todas</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Media</option>
              <option value="BAIXA">Baixa</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200">
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <Card className="border-slate-200 p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th>Sistema</th>
                <th>Acesso / Perfil</th>
                <th>Tipo</th>
                <th>Origem</th>
                <th className="text-center">Criticidade</th>
                <th>Expira em</th>
                <th className="text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => {
                const criticality = guessCriticality(item.permission.name);
                const type = item.permission.name.toLowerCase().includes("group") ? "Grupo" : "Role";
                return (
                  <tr key={item.id} className="border-b border-slate-100 text-slate-800 transition hover:bg-slate-50/60">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[#e7d7ac] bg-white">
                          <img src={resolveSystemThumb(item.permission.system.name)} alt={`${item.permission.system.name} logo`} className="h-6 w-6 object-contain" />
                        </div>
                        <span className="font-medium">{toFriendlyLabel(item.permission.system.name, "Sem sistema")}</span>
                      </div>
                    </td>
                    <td>
                      <div className="group max-w-[420px]">
                        <span
                          className="cursor-help border-b border-dotted border-slate-300"
                          title={toFriendlyLabel(item.permission.description, "Sem descricao da SR.")}
                        >
                          {toFriendlyLabel(item.permission.name, "Sem role")}
                        </span>
                        <div className="mt-1 hidden w-full max-w-[420px] rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-sm group-hover:block">
                          <p className="font-semibold text-slate-900">Descricao da SR</p>
                          <p className="mt-1 leading-relaxed">{toFriendlyLabel(item.permission.description, "Sem descricao da SR.")}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{type}</span>
                    </td>
                    <td className="text-slate-600">{formatAssignmentSource(item.source)}</td>
                    <td className="text-center">{badgeCriticality(criticality)}</td>
                    <td>
                      {item.source === "BR"
                        ? "-"
                        : (() => {
                            const requestMeta = latestRequestByPermissionId.get(item.permissionId);
                            if (!requestMeta) return "-";
                            return formatDate(addMonths(requestMeta.requestCreatedAt, requestMeta.durationMonths));
                          })()}
                    </td>
                    <td className="text-right">
                      <Link href="/request/new" className="text-sm font-semibold text-[#800020] hover:underline">
                        Solicitar ajuste
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <PaginationControls
            basePath="/my-access"
            page={safePage}
            pageSize={pageSize}
            totalItems={totalAssignments}
            query={{ q, system: systemFilter, source: sourceFilter, criticality: criticalityFilter }}
          />
          {assignments.length === 0 ? <p className="pt-2 text-sm text-slate-500">Nenhuma permissao atribuida.</p> : null}
        </div>
      </Card>
    </AppShell>
  );
}
