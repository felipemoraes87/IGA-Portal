import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";
import { toFriendlyLabel } from "@/lib/utils";

export default async function MySystemsPage() {
  const user = await requirePageUser("USER");

  const ownedSystems = await db.system.findMany({
    where: { ownerId: user.id },
    orderBy: { name: "asc" },
    include: {
      permissions: {
        select: { id: true, name: true },
      },
    },
  });

  const metrics = await Promise.all(
    ownedSystems.map(async (system) => {
      const [pendingRequests, distinctUsersWithAccess] = await Promise.all([
        db.accessRequest.count({
          where: {
            status: "PENDING_APPROVAL",
            permission: { systemId: system.id },
          },
        }),
        db.userPermissionAssignment.findMany({
          where: {
            permission: { systemId: system.id },
          },
          select: { userId: true },
          distinct: ["userId"],
        }),
      ]);

      return {
        systemId: system.id,
        srCount: system.permissions.length,
        usersWithAccess: distinctUsersWithAccess.length,
        pendingRequests,
      };
    }),
  );

  const metricBySystem = new Map(metrics.map((item) => [item.systemId, item]));

  return (
    <AppShell user={user} title="Meus Sistemas" description="Visao dos sistemas sob sua ownership e indicadores de governanca.">
      <Card className="border-slate-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Sistemas do Owner</h3>
          <span className="rounded-full bg-[#fff8e8] px-3 py-1 text-xs font-bold text-[#800020]">
            {ownedSystems.length} sistemas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr>
                <th>Sistema</th>
                <th>Total SRs</th>
                <th>Usuarios com acesso</th>
                <th>Pendencias de aprovacao</th>
              </tr>
            </thead>
            <tbody>
              {ownedSystems.map((system) => {
                const metric = metricBySystem.get(system.id);
                return (
                  <tr key={system.id} className="border-b border-slate-100 text-slate-800">
                    <td>
                      <div className="flex items-center gap-2 font-medium">
                        <img src={resolveSystemThumb(system.name)} alt={`${system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                        <Link href={`/my-systems/${encodeURIComponent(system.id)}`} className="text-[#800020] hover:underline">
                          {toFriendlyLabel(system.name, "Sem sistema")}
                        </Link>
                      </div>
                    </td>
                    <td>{metric?.srCount ?? 0}</td>
                    <td>{metric?.usersWithAccess ?? 0}</td>
                    <td>{metric?.pendingRequests ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ownedSystems.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500">Voce ainda nao possui sistemas vinculados como owner.</p>
          ) : null}
        </div>

        <div className="mt-4">
          <Link href="/admin/systems" className="text-sm font-semibold text-[#800020] hover:underline">
            Ver cadastro completo de sistemas
          </Link>
        </div>
      </Card>
    </AppShell>
  );
}
