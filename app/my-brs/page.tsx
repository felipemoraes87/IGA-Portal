import { AppShell } from "@/components/app-shell";
import { MyBrsSplitView } from "@/components/my-brs-split-view";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

export default async function MyBrsPage() {
  const user = await requirePageUser("USER");

  const ownedBrRows = await db.orchestratorBusinessRole.findMany({
    where: {
      ownerId: user.id,
      isCurrent: { equals: "true", mode: "insensitive" },
      id: { not: null },
    },
    orderBy: { name: "asc" },
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
    distinct: ["id"],
  });

  const ownedBrIds = ownedBrRows
    .map((item) => item.id)
    .filter((value): value is string => Boolean(value));

  const brs = await db.businessRole.findMany({
    where: {
      id: { in: ownedBrIds },
    },
    include: {
      permissions: {
        include: {
          permission: {
            include: {
              system: {
                select: {
                  criticality: true,
                },
              },
            },
          },
        },
      },
      users: {
        include: {
          user: {
            select: {
              active: true,
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const aliasById = new Map(
    ownedBrRows.map((item) => [
      item.id ?? "",
      {
        displayName: item.name,
        technicalId: item.technicalId,
        associationCriteria: item.associationCriteria,
        company: item.company,
        owner: item.owner,
        status: item.status,
        lastRevisionDate: item.lastRevisionDate,
        nextRevisionDate: item.nextRevisionDate,
      },
    ]),
  );

  const rows = brs.map((br) => {
    const alias = aliasById.get(br.id);
    const activeUsers = br.users.filter((item) => item.user.active).length;
    const inactiveUsers = br.users.length - activeUsers;
    const criticalSrCount = br.permissions.filter((item) => item.permission.system.criticality === "HIGH").length;
    return {
      id: br.id,
      name: toFriendlyLabel(alias?.displayName || br.name, "Sem nome"),
      technicalId: toFriendlyLabel(alias?.technicalId, "-"),
      totalSrs: br.permissions.length,
      totalUsers: br.users.length,
      activeUsers,
      inactiveUsers,
      criticalSrCount,
      status: toFriendlyLabel(alias?.status, "-"),
      company: toFriendlyLabel(alias?.company, "-"),
      ownerName: toFriendlyLabel(alias?.owner, "-"),
      associationCriteria: toFriendlyLabel(alias?.associationCriteria, "Sem criterio informado."),
      lastRevisionDate: toFriendlyLabel(alias?.lastRevisionDate, "-"),
      nextRevisionDate: toFriendlyLabel(alias?.nextRevisionDate, "-"),
    };
  });

  return (
    <AppShell user={user} title="Minhas BRs" description="Visao das Business Roles em sua ownership e seus impactos.">
      <Card className="border-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Business Roles do Owner</h3>
          <span className="rounded-full bg-[#fff8e8] px-3 py-1 text-xs font-bold text-[#800020]">{brs.length} BRs</span>
        </div>

        <MyBrsSplitView rows={rows} />
      </Card>
    </AppShell>
  );
}
