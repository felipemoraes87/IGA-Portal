import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export default async function MySystemDetailPage({ params }: Readonly<{ params: Params }>) {
  const user = await requirePageUser("USER");
  const { id } = await params;

  const system = await db.system.findFirst({
    where: { id, ownerId: user.id },
    include: {
      permissions: {
        orderBy: { name: "asc" },
        include: {
          assignments: {
            select: { userId: true },
            distinct: ["userId"],
          },
        },
      },
    },
  });
  if (!system) notFound();

  const [pendingRequests, distinctUsersWithAccess] = await Promise.all([
    db.accessRequest.count({
      where: { status: "PENDING_APPROVAL", permission: { systemId: system.id } },
    }),
    db.userPermissionAssignment.findMany({
      where: { permission: { systemId: system.id } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  return (
    <AppShell user={user} title="Detalhe do Sistema" description="Métricas de governança e cobertura de SRs do sistema.">
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/my-systems" className="hover:text-[#800020]">Meus Sistemas</Link>
        <span>/</span>
        <span className="font-semibold text-slate-900">{toFriendlyLabel(system.name, system.id)}</span>
      </nav>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Total de SRs</p>
          <p className="mt-1 text-3xl font-bold text-[#800020]">{system.permissions.length}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Usuarios com acesso</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{distinctUsersWithAccess.length}</p>
        </Card>
        <Card className="border-slate-200">
          <p className="text-sm text-slate-500">Pendencias de aprovacao</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{pendingRequests}</p>
        </Card>
      </section>

      <Card className="border-slate-200">
        <h3 className="mb-3 text-lg font-bold text-slate-900">SRs do sistema</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr>
                <th>SR</th>
                <th>Usuarios com acesso</th>
                <th className="text-right">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {system.permissions.map((sr) => (
                <tr key={sr.id} className="border-b border-slate-100 text-slate-800">
                  <td>{toFriendlyLabel(sr.name, sr.id)}</td>
                  <td>{sr.assignments.length}</td>
                  <td className="text-right">
                    <Link href={`/my-srs/${encodeURIComponent(sr.id)}`} className="text-sm font-semibold text-[#800020] hover:underline">
                      Abrir SR
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {system.permissions.length === 0 ? <p className="px-3 py-6 text-sm text-slate-500">Sem SRs associadas.</p> : null}
        </div>
      </Card>
    </AppShell>
  );
}
