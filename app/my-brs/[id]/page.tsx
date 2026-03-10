import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { MyBrSrSplitView } from "@/components/my-br-sr-split-view";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default async function MyBrDetailPage({ params }: Readonly<{ params: Params }>) {
  const user = await requirePageUser("USER");
  const { id } = await params;

  const ownership = await db.orchestratorBusinessRole.findFirst({
    where: {
      id,
      ownerId: user.id,
      isCurrent: { equals: "true", mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      technicalId: true,
      associationCriteria: true,
      company: true,
      owner: true,
      status: true,
      lastRevisionDate: true,
      nextRevisionDate: true,
    },
  });
  if (!ownership?.id) notFound();

  const br = await db.businessRole.findFirst({
    where: { id: ownership.id },
    include: {
      permissions: {
        include: {
          permission: {
            include: {
              owner: { select: { id: true, name: true } },
              system: {
                select: {
                  id: true,
                  name: true,
                  criticality: true,
                  owner: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { permission: { name: "asc" } },
      },
      users: {
        include: {
          user: { select: { id: true, name: true, email: true, active: true } },
        },
        orderBy: { user: { name: "asc" } },
      },
    },
  });
  if (!br) notFound();

  const permissionIds = br.permissions.map((item) => item.permission.id);
  const srNames = permissionIds.length
    ? await db.orchestratorSystemRole.findMany({
        where: {
          id: { in: permissionIds },
          isCurrent: { equals: "true", mode: Prisma.QueryMode.insensitive },
        },
        orderBy: [{ updatedAt: "desc" }, { rowId: "desc" }],
        select: { id: true, name: true, origin: true, risk: true, updatedAt: true },
      })
    : [];

  const srById = new Map<string, { name: string; origin: string; risk: string; updatedAt: string }>();
  for (const sr of srNames) {
    if (!sr.id || srById.has(sr.id)) continue;
    srById.set(sr.id, {
      name: sr.name || "",
      origin: sr.origin || "",
      risk: sr.risk || "",
      updatedAt: sr.updatedAt || "",
    });
  }

  const [assignmentCounts, pendingCounts, latestRequests] = permissionIds.length
    ? await Promise.all([
        db.userPermissionAssignment.groupBy({
          by: ["permissionId"],
          where: { permissionId: { in: permissionIds } },
          _count: { _all: true },
        }),
        db.accessRequest.groupBy({
          by: ["permissionId"],
          where: { permissionId: { in: permissionIds }, status: "PENDING_APPROVAL" },
          _count: { _all: true },
        }),
        db.accessRequest.groupBy({
          by: ["permissionId"],
          where: { permissionId: { in: permissionIds } },
          _max: { createdAt: true },
        }),
      ])
    : [[], [], []];

  const assignmentCountByPermission = new Map(assignmentCounts.map((item) => [item.permissionId, item._count._all]));
  const pendingCountByPermission = new Map(pendingCounts.map((item) => [item.permissionId, item._count._all]));
  const latestRequestByPermission = new Map(
    latestRequests
      .filter((item): item is { permissionId: string; _max: { createdAt: Date } } => !!item._max.createdAt)
      .map((item) => [item.permissionId, item._max.createdAt.toISOString()]),
  );

  const srRows = br.permissions.map((item) => ({
    permissionId: item.permission.id,
    name: toFriendlyLabel(srById.get(item.permission.id)?.name, toFriendlyLabel(item.permission.name, item.permission.id)),
    description: toFriendlyLabel(item.permission.description, "Sem descricao da SR."),
    systemId: item.permission.system.id,
    systemName: toFriendlyLabel(item.permission.system.name, item.permission.system.id),
    systemCriticality: item.permission.system.criticality,
    srOwnerName: toFriendlyLabel(item.permission.owner?.name, "-"),
    systemOwnerName: toFriendlyLabel(item.permission.system.owner?.name, "-"),
    origin: toFriendlyLabel(srById.get(item.permission.id)?.origin, "-"),
    risk: toFriendlyLabel(srById.get(item.permission.id)?.risk, "-"),
    updatedAt: toFriendlyLabel(srById.get(item.permission.id)?.updatedAt, "-"),
    assignmentsCount: assignmentCountByPermission.get(item.permission.id) || 0,
    pendingCount: pendingCountByPermission.get(item.permission.id) || 0,
    latestRequestAt: latestRequestByPermission.get(item.permission.id) || "",
  }));

  return (
    <AppShell user={user} title="Detalhe da BR" description="Composicao da BR, SRs vinculadas e usuarios impactados.">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/my-brs" className="hover:text-[#800020]">Minhas BRs</Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">{toFriendlyLabel(ownership.name || br.name, br.id)}</span>
      </nav>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Technical ID</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{ownership.technicalId || "-"}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">SRs vinculadas</p>
          <p className="mt-1 text-3xl font-bold text-[#800020]">{br.permissions.length}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Usuarios na BR</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{br.users.length}</p>
        </Card>
      </section>

      <Card className="border-slate-200">
        <h3 className="mb-3 text-lg font-bold text-slate-900">Governanca da BR</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-slate-500">Criterio de associacao</p>
              <p className="text-slate-800">{toFriendlyLabel(ownership.associationCriteria, "Sem criterio informado.")}</p>
            </div>
            <div>
              <p className="text-slate-500">Empresa</p>
              <p className="font-medium text-slate-900">{toFriendlyLabel(ownership.company, "-")}</p>
            </div>
            <div>
              <p className="text-slate-500">Owner legado</p>
              <p className="font-medium text-slate-900">{toFriendlyLabel(ownership.owner, "-")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Status</p>
              <p className="font-medium text-slate-900">{toFriendlyLabel(ownership.status, "-")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Ultima revisao</p>
              <p className="font-medium text-slate-900">{toFriendlyLabel(ownership.lastRevisionDate, "-")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Proxima revisao</p>
              <p className="font-medium text-slate-900">{toFriendlyLabel(ownership.nextRevisionDate, "-")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-slate-500">Usuarios ativos</p>
              <p className="font-medium text-slate-900">{br.users.filter((item) => item.user.active).length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-slate-200">
        <h3 className="mb-3 text-lg font-bold text-slate-900">SRs desta BR</h3>
        <MyBrSrSplitView rows={srRows} />
      </Card>

      <Card className="border-slate-200">
        <h3 className="mb-3 text-lg font-bold text-slate-900">Usuarios nesta BR</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {br.users.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 text-slate-800">
                  <td>{item.user.name}</td>
                  <td>{item.user.email}</td>
                  <td>{item.user.active ? "Ativo" : "Inativo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {br.users.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Sem usuarios vinculados.</p> : null}
        </div>
      </Card>
    </AppShell>
  );
}
