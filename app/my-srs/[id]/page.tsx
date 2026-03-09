import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";
import { formatDate, toFriendlyLabel } from "@/lib/utils";

type Params = Promise<{ id: string }>;

function addMonths(base: Date, months: number) {
  const result = new Date(base);
  result.setMonth(result.getMonth() + months);
  return result;
}

export default async function MySrDetailPage({ params }: Readonly<{ params: Params }>) {
  const user = await requirePageUser("USER");
  const { id } = await params;

  const sr = await db.permission.findFirst({
    where: {
      id,
      OR: [{ ownerId: user.id }, { system: { ownerId: user.id } }],
    },
    include: {
      system: { select: { id: true, name: true } },
      assignments: {
        include: {
          user: { select: { id: true, name: true, email: true, active: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!sr) notFound();

  const [pendingRequests, recentRequests] = await Promise.all([
    db.accessRequest.count({
      where: { permissionId: sr.id, status: "PENDING_APPROVAL" },
    }),
    db.accessRequest.findMany({
      where: { permissionId: sr.id },
      include: {
        requester: { select: { name: true, email: true } },
        targetUser: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const usersById = new Map<string, (typeof sr.assignments)[number]>();
  for (const assignment of sr.assignments) {
    if (!usersById.has(assignment.userId)) usersById.set(assignment.userId, assignment);
  }
  const uniqueAssignments = Array.from(usersById.values());

  const directUserIds = Array.from(
    new Set(uniqueAssignments.filter((item) => item.source === "DIRECT").map((item) => item.userId)),
  );

  const directRequests =
    directUserIds.length > 0
      ? await db.accessRequest.findMany({
          where: {
            permissionId: sr.id,
            targetUserId: { in: directUserIds },
            status: { in: ["APPROVED", "RUNNING", "SUCCESS"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, targetUserId: true, createdAt: true },
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

  const revocationByUserId = new Map<string, Date>();
  for (const req of directRequests) {
    if (revocationByUserId.has(req.targetUserId)) continue;
    const durationMonths = durationByRequestId.get(req.id);
    if (!durationMonths) continue;
    revocationByUserId.set(req.targetUserId, addMonths(req.createdAt, durationMonths));
  }

  return (
    <AppShell user={user} title="Detalhe da SR" description="Ownership, acessos e solicitações relacionadas a esta System Role.">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/my-srs" className="hover:text-[#800020]">Minhas SRs</Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">{toFriendlyLabel(sr.name, sr.id)}</span>
      </nav>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Usuarios com acesso</p>
          <p className="mt-1 text-3xl font-bold text-[#800020]">{uniqueAssignments.length}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Pendentes de aprovacao</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{pendingRequests}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Sistema</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
            <img src={resolveSystemThumb(sr.system.name)} alt={`${sr.system.name} logo`} className="h-5 w-5 rounded-md border border-[#e7d7ac] bg-white p-0.5" />
            <span>{toFriendlyLabel(sr.system.name, sr.system.id)}</span>
          </p>
        </Card>
      </section>

      <Card className="border-slate-200">
        <p className="text-sm font-semibold text-slate-700">Descricao da SR</p>
        <p className="mt-1 text-sm text-slate-600">{toFriendlyLabel(sr.description, "Sem descricao da SR.")}</p>
      </Card>

      <Card className="border-slate-200">
        <h3 className="mb-3 text-lg font-bold text-slate-900">Quem tem acesso a esta SR</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Origem</th>
                <th>Ultima atribuicao</th>
                <th>Data de revogacao</th>
              </tr>
            </thead>
            <tbody>
              {uniqueAssignments.map((item) => (
                (() => {
                  const revocationDate = revocationByUserId.get(item.userId);
                  return (
                    <tr key={item.userId} className="border-b border-slate-100 text-slate-800">
                      <td>{item.user.name}</td>
                      <td>{item.user.email}</td>
                      <td>{item.source}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.source === "BR" ? "" : revocationDate ? formatDate(revocationDate) : ""}</td>
                    </tr>
                  );
                })()
              ))}
            </tbody>
          </table>
          {uniqueAssignments.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Nenhum acesso registrado.</p> : null}
        </div>
      </Card>

      <Card className="border-slate-200">
        <h3 className="mb-3 text-lg font-bold text-slate-900">Solicitacoes recentes desta SR</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr>
                <th>ID</th>
                <th>Solicitante</th>
                <th>Usuario alvo</th>
                <th>Status</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((req) => (
                <tr key={req.id} className="border-b border-slate-100 text-slate-800">
                  <td>#{req.id.slice(0, 8)}</td>
                  <td>{req.requester.name}</td>
                  <td>{req.targetUser.name}</td>
                  <td>{req.status}</td>
                  <td>{formatDate(req.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentRequests.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Sem solicitacoes para esta SR.</p> : null}
        </div>
      </Card>
    </AppShell>
  );
}
