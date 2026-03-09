import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type SearchParams = Promise<{ q?: string }>;

export default async function AdminBusinessRolesPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;

  const where: Prisma.BusinessRoleWhereInput = {};
  if (params.q) {
    where.OR = [
      { id: { contains: params.q, mode: "insensitive" } },
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { permissions: { some: { permission: { name: { contains: params.q, mode: "insensitive" } } } } },
      { users: { some: { user: { email: { contains: params.q, mode: "insensitive" } } } } },
      { users: { some: { user: { name: { contains: params.q, mode: "insensitive" } } } } },
    ];
  }

  const roles = await db.businessRole.findMany({
    where,
    include: {
      permissions: {
        include: {
          permission: {
            include: {
              system: true,
            },
          },
        },
      },
      users: {
        include: {
          user: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <AppShell user={user} title="Admin - Business Roles" description="Mapeamentos BR -> permissoes e usuarios vinculados.">
      <Card>
        <form className="grid gap-3 md:grid-cols-3" method="get">
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Buscar BR, permissao ou usuario"
            className="md:col-span-2 rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a]">Filtrar</button>
        </form>
      </Card>

      <div className="space-y-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <h3 className="text-lg font-bold text-slate-900">{toFriendlyLabel(role.name, "Sem business role")}</h3>
            <p className="text-sm text-slate-500">{role.description || "Sem descricao"}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Permissoes vinculadas</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {role.permissions.map((link) => (
                    <li key={link.id}>
                      {toFriendlyLabel(link.permission.system.name, "Sem sistema")} - {toFriendlyLabel(link.permission.name, "Sem role")}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Usuarios atribuidos</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {role.users.map((link) => (
                    <li key={link.id}>
                      {link.user.name} ({link.user.email})
                    </li>
                  ))}
                  {role.users.length === 0 ? <li>Nenhum usuario vinculado.</li> : null}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}


