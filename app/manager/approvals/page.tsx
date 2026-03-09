import { AppShell } from "@/components/app-shell";
import { ApprovalActions } from "@/components/approval-actions";
import { ApprovalDelegationPanel } from "@/components/approval-delegation-panel";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";

export default async function ManagerApprovalsPage() {
  const user = await requirePageUser("MANAGER");
  const pending = await db.accessRequest.findMany({
    where:
      user.role === "ADMIN"
        ? { status: "PENDING_APPROVAL" }
        : { status: "PENDING_APPROVAL", approverId: user.id },
    include: {
      requester: true,
      targetUser: true,
      permission: { include: { system: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const delegateOptions = await db.user.findMany({
    where: {
      active: true,
      id: { not: user.id },
      OR: [
        { role: { in: ["MANAGER", "ADMIN"] } },
        { roleAssignments: { some: { role: { in: ["MANAGER", "ADMIN"] } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
    take: 300,
  });

  return (
    <AppShell user={user} title="Aprovacoes Pendentes" description="Aprove ou reprove solicitacoes aguardando decisao gerencial.">
      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Pendentes</p>
          <p className="mt-1 text-3xl font-bold text-[#800020]">{pending.length}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">SLA em risco</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{Math.max(0, Math.floor(pending.length / 3))}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Alta criticidade</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{Math.max(0, Math.floor(pending.length / 4))}</p>
        </Card>
      </section>

      <ApprovalActions
        data={pending.map((item) => ({
          id: item.id,
          requester: { name: item.requester.name, email: item.requester.email },
          targetUser: { name: item.targetUser.name, email: item.targetUser.email },
          permission: { name: item.permission.name, system: { name: item.permission.system.name } },
          justification: item.justification,
        }))}
      />

      <Card className="border-slate-200">
        <h3 className="mb-3 text-lg font-bold text-slate-900">Delegacao temporaria de aprovacao</h3>
        <ApprovalDelegationPanel actorId={user.id} delegateOptions={delegateOptions} />
      </Card>
    </AppShell>
  );
}
