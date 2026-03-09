import { Criticality, Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type SearchParams = Promise<{ q?: string; criticality?: string; page?: string; pageSize?: string }>;

export default async function AdminSystemsPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);

  const where: Prisma.SystemWhereInput = {};
  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { id: { contains: params.q, mode: "insensitive" } },
      { permissions: { some: { name: { contains: params.q, mode: "insensitive" } } } },
    ];
  }

  const validCriticality: Criticality[] = ["LOW", "MED", "HIGH"];
  if (params.criticality && validCriticality.includes(params.criticality as Criticality)) {
    where.criticality = params.criticality as Criticality;
  }

  const totalSystems = await db.system.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalSystems / pageSize));
  const safePage = Math.min(page, totalPages);

  const systems = await db.system.findMany({
    where,
    include: {
      permissions: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  return (
    <AppShell user={user} title="Admin - Systems" description="Listagem de sistemas e roles/permissoes cadastradas.">
      <Card>
        <form className="mb-4 grid gap-3 md:grid-cols-3" method="get">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Buscar por sistema ou permissao"
            className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
          />
          <select name="criticality" defaultValue={params.criticality || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todas criticidades</option>
            <option value="LOW">LOW</option>
            <option value="MED">MED</option>
            <option value="HIGH">HIGH</option>
          </select>
          <button className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a]">Filtrar</button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-[#f1e6c9] text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Sistema</th>
                <th className="py-2">Criticidade</th>
                <th className="py-2">Permissoes</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((system) => (
                <tr key={system.id} className="border-b border-[#f7edd5] text-slate-800">
                  <td className="py-2 font-semibold">{toFriendlyLabel(system.name, "Sem sistema")}</td>
                  <td className="py-2">{system.criticality}</td>
                  <td className="py-2">
                    <ul>
                      {system.permissions.map((permission) => (
                        <li key={permission.id}>
                          {toFriendlyLabel(permission.name, "Sem role")} {permission.description ? `- ${permission.description}` : ""}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/admin/systems"
          page={safePage}
          pageSize={pageSize}
          totalItems={totalSystems}
          query={{ q: params.q, criticality: params.criticality }}
        />
      </Card>
    </AppShell>
  );
}


