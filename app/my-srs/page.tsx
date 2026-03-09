import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";
import { formatDate, toFriendlyLabel } from "@/lib/utils";

type SearchParams = Promise<{
  q?: string;
  pending?: string;
  expiring?: string;
  direct?: string;
  page?: string;
  pageSize?: string;
}>;

function addMonths(base: Date, months: number) {
  const result = new Date(base);
  result.setMonth(result.getMonth() + months);
  return result;
}

function kpiTone(type: "neutral" | "warning" | "danger") {
  if (type === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (type === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function MySrsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("USER");
  const params = await searchParams;

  const q = (params.q || "").trim().toLowerCase();
  const onlyPending = params.pending === "true";
  const onlyExpiring = params.expiring === "true";
  const onlyDirect = params.direct === "true";
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);

  const ownedSrs = await db.permission.findMany({
    where: {
      OR: [{ ownerId: user.id }, { system: { ownerId: user.id } }],
    },
    orderBy: { name: "asc" },
    include: {
      system: {
        select: { id: true, name: true },
      },
    },
  });

  const permissionIds = ownedSrs.map((sr) => sr.id);
  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const assignments =
    permissionIds.length > 0
      ? await db.userPermissionAssignment.findMany({
          where: { permissionId: { in: permissionIds } },
          select: {
            permissionId: true,
            userId: true,
            source: true,
            user: { select: { active: true } },
          },
        })
      : [];

  const pendingByPermissionRows =
    permissionIds.length > 0
      ? await db.accessRequest.groupBy({
          by: ["permissionId"],
          where: {
            permissionId: { in: permissionIds },
            status: "PENDING_APPROVAL",
          },
          _count: { _all: true },
        })
      : [];

  const latestRequestByPermissionRows =
    permissionIds.length > 0
      ? await db.accessRequest.groupBy({
          by: ["permissionId"],
          where: {
            permissionId: { in: permissionIds },
          },
          _max: { createdAt: true },
        })
      : [];

  const directRequests =
    permissionIds.length > 0
      ? await db.accessRequest.findMany({
          where: {
            permissionId: { in: permissionIds },
            status: { in: ["APPROVED", "RUNNING", "SUCCESS"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, permissionId: true, targetUserId: true, createdAt: true },
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

  const activeUsersByPermission = new Map<string, Set<string>>();
  const directUsersByPermission = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    if (!assignment.user.active) continue;

    const activeSet = activeUsersByPermission.get(assignment.permissionId) || new Set<string>();
    activeSet.add(assignment.userId);
    activeUsersByPermission.set(assignment.permissionId, activeSet);

    if (assignment.source === "DIRECT") {
      const directSet = directUsersByPermission.get(assignment.permissionId) || new Set<string>();
      directSet.add(assignment.userId);
      directUsersByPermission.set(assignment.permissionId, directSet);
    }
  }

  const pendingByPermission = new Map<string, number>(pendingByPermissionRows.map((row) => [row.permissionId, row._count._all]));
  const latestRequestByPermission = new Map<string, Date>(
    latestRequestByPermissionRows
      .filter((row): row is { permissionId: string; _max: { createdAt: Date } } => !!row._max.createdAt)
      .map((row) => [row.permissionId, row._max.createdAt]),
  );

  const durationByRequestId = new Map<string, number>();
  for (const row of requestAuditRows) {
    const details = row.details;
    if (!details || Array.isArray(details) || typeof details !== "object") continue;
    const durationValue = (details as Record<string, unknown>).accessDurationMonths;
    if (typeof durationValue === "number" && [1, 3, 6, 12].includes(durationValue)) {
      durationByRequestId.set(row.entityId, durationValue);
    }
  }

  const revocationsSoonByPermission = new Map<string, number>();
  const latestRequestByPermissionAndUser = new Map<string, { permissionId: string; targetUserId: string; createdAt: Date; durationMonths: number }>();
  for (const req of directRequests) {
    const durationMonths = durationByRequestId.get(req.id);
    if (!durationMonths) continue;
    const key = `${req.permissionId}::${req.targetUserId}`;
    if (latestRequestByPermissionAndUser.has(key)) continue;
    latestRequestByPermissionAndUser.set(key, {
      permissionId: req.permissionId,
      targetUserId: req.targetUserId,
      createdAt: req.createdAt,
      durationMonths,
    });
  }

  for (const request of latestRequestByPermissionAndUser.values()) {
    const expiresAt = addMonths(request.createdAt, request.durationMonths);
    if (expiresAt < now || expiresAt > in30Days) continue;
    revocationsSoonByPermission.set(request.permissionId, (revocationsSoonByPermission.get(request.permissionId) || 0) + 1);
  }

  const rows = ownedSrs
    .map((sr) => {
      const activeUsers = activeUsersByPermission.get(sr.id)?.size || 0;
      const directUsers = directUsersByPermission.get(sr.id)?.size || 0;
      const pending = pendingByPermission.get(sr.id) || 0;
      const expiringSoon = revocationsSoonByPermission.get(sr.id) || 0;
      const latestRequestAt = latestRequestByPermission.get(sr.id) || null;

      return {
        id: sr.id,
        name: toFriendlyLabel(sr.name, sr.id),
        description: toFriendlyLabel(sr.description, "Sem descricao da SR."),
        systemId: sr.system.id,
        systemName: toFriendlyLabel(sr.system.name, sr.system.id),
        activeUsers,
        directUsers,
        pending,
        expiringSoon,
        latestRequestAt,
      };
    })
    .filter((row) => {
      if (q) {
        const haystack = `${row.name} ${row.systemName} ${row.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (onlyPending && row.pending === 0) return false;
      if (onlyExpiring && row.expiringSoon === 0) return false;
      if (onlyDirect && row.directUsers === 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      if (b.expiringSoon !== a.expiringSoon) return b.expiringSoon - a.expiringSoon;
      return a.name.localeCompare(b.name);
    });

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const totalDirectUsers = rows.reduce((acc, row) => acc + row.directUsers, 0);
  const totalPending = rows.reduce((acc, row) => acc + row.pending, 0);
  const totalExpiringSoon = rows.reduce((acc, row) => acc + row.expiringSoon, 0);

  return (
    <AppShell user={user} title="Minhas SRs" description="Painel de governanca para priorizar aprovacoes, acessos diretos e revogacoes por SR.">
      <section className="grid gap-3 md:grid-cols-4">
        <Card className={`border ${kpiTone("neutral")}`}>
          <p className="text-xs uppercase tracking-wide">SRs sob ownership</p>
          <p className="mt-1 text-3xl font-bold">{rows.length}</p>
        </Card>
        <Card className={`border ${kpiTone("neutral")}`}>
          <p className="text-xs uppercase tracking-wide">Usuarios com acesso direto</p>
          <p className="mt-1 text-3xl font-bold">{totalDirectUsers}</p>
        </Card>
        <Card className={`border ${kpiTone(totalPending > 0 ? "warning" : "neutral")}`}>
          <p className="text-xs uppercase tracking-wide">Pendencias de aprovacao</p>
          <p className="mt-1 text-3xl font-bold">{totalPending}</p>
        </Card>
        <Card className={`border ${kpiTone(totalExpiringSoon > 0 ? "danger" : "neutral")}`}>
          <p className="text-xs uppercase tracking-wide">Revogacoes em 30 dias</p>
          <p className="mt-1 text-3xl font-bold">{totalExpiringSoon}</p>
        </Card>
      </section>

      <Card className="border-slate-200 p-4">
        <form method="get" className="grid gap-3 md:grid-cols-5">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Buscar SR / Sistema</label>
            <input name="q" defaultValue={params.q || ""} placeholder="Nome da SR, sistema ou descricao" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-end gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="pending" value="true" defaultChecked={onlyPending} />
            Apenas com pendencias
          </label>
          <label className="flex items-end gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="expiring" value="true" defaultChecked={onlyExpiring} />
            Apenas revogacao proxima
          </label>
          <label className="flex items-end gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" name="direct" value="true" defaultChecked={onlyDirect} />
            Apenas acesso direto
          </label>
          <div className="md:col-span-5">
            <button className="rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              Aplicar filtros
            </button>
          </div>
        </form>
      </Card>

      <Card className="border-slate-200 p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr>
                <th>SR</th>
                <th>Sistema</th>
                <th>Descricao</th>
                <th className="text-center">Usuarios</th>
                <th className="text-center">Diretos</th>
                <th className="text-center">Pendentes</th>
                <th className="text-center">Revog. 30d</th>
                <th>Ultima solicitacao</th>
                <th className="text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                  <td className="font-semibold text-[#800020]">{row.name}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <img src={resolveSystemThumb(row.systemName)} alt={`${row.systemName} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                      {row.systemName}
                    </span>
                  </td>
                  <td className="max-w-[460px] text-slate-600">{row.description}</td>
                  <td className="text-center">{row.activeUsers}</td>
                  <td className="text-center">{row.directUsers}</td>
                  <td className="text-center">
                    <span className={row.pending > 0 ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700" : "text-slate-500"}>
                      {row.pending}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={row.expiringSoon > 0 ? "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700" : "text-slate-500"}>
                      {row.expiringSoon}
                    </span>
                  </td>
                  <td className="text-slate-600">{row.latestRequestAt ? formatDate(row.latestRequestAt) : "-"}</td>
                  <td className="text-right">
                    <Link href={`/my-srs/${encodeURIComponent(row.id)}`} className="text-sm font-semibold text-[#800020] hover:underline">
                      Ver detalhe
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <PaginationControls
            basePath="/my-srs"
            page={safePage}
            pageSize={pageSize}
            totalItems={totalRows}
            query={{
              q: params.q,
              pending: onlyPending ? "true" : undefined,
              expiring: onlyExpiring ? "true" : undefined,
              direct: onlyDirect ? "true" : undefined,
            }}
          />
          {pageRows.length === 0 ? <p className="pt-2 text-sm text-slate-500">Nenhuma SR encontrada com os filtros aplicados.</p> : null}
        </div>
      </Card>
    </AppShell>
  );
}
