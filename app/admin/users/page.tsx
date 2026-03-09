import { Prisma, UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";

type SearchParams = Promise<{ q?: string; role?: string; page?: string; pageSize?: string }>;

export default async function AdminUsersPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);

  const andFilters: Prisma.UserWhereInput[] = [];
  if (params.q) {
    andFilters.push({
      OR: [
      { id: { contains: params.q, mode: "insensitive" } },
      { name: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }

  const validRoles: UserRole[] = ["USER", "MANAGER", "ADMIN"];
  if (params.role && validRoles.includes(params.role as UserRole)) {
    const selectedRole = params.role as UserRole;
    andFilters.push({
      OR: [
        { role: selectedRole },
        { roleAssignments: { some: { role: selectedRole } } },
      ],
    });
  }
  const where: Prisma.UserWhereInput = andFilters.length ? { AND: andFilters } : {};

  const totalUsers = await db.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const safePage = Math.min(page, totalPages);

  const users = await db.user.findMany({
    where,
    include: {
      manager: true,
      reports: true,
      roleAssignments: true,
    },
    orderBy: { name: "asc" },
    skip: (safePage - 1) * pageSize,
    take: pageSize,
  });

  return (
    <AppShell user={user} title="Admin - Users" description="Gestao de perfis RBAC e relacao gestor-liderado.">
      <Card>
        <form className="mb-4 grid gap-3 rounded-xl border border-[#f1e6c9] bg-[#fff8e8]/40 p-3 md:grid-cols-3" method="get">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Buscar por nome ou email"
            className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
          />
          <select name="role" defaultValue={params.role || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todos os perfis</option>
            <option value="USER">USER</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a]">Filtrar</button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/30 p-2">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Nome</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Gestor</th>
                <th className="py-2">Qtd. Liderados</th>
                <th className="py-2">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id} className="border-b border-[#f7edd5] text-slate-800">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.email}</td>
                  <td className="py-2">
                    <RoleBadges roles={item.roleAssignments.map((assignment) => assignment.role)} fallbackRole={item.role} />
                  </td>
                  <td className="py-2">{item.manager?.name || "-"}</td>
                  <td className="py-2">{item.reports.length}</td>
                  <td className="py-2">
                    <ActiveBadge active={item.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/admin/users"
          page={safePage}
          pageSize={pageSize}
          totalItems={totalUsers}
          query={{ q: params.q, role: params.role }}
        />
      </Card>
    </AppShell>
  );
}

function RoleBadges({ roles, fallbackRole }: Readonly<{ roles: string[]; fallbackRole: string }>) {
  const source = roles.length ? roles : [fallbackRole];
  const dedup = new Set(source);
  dedup.add("USER");
  const ordered = ["ADMIN", "MANAGER", "USER"].filter((role) => dedup.has(role));

  return (
    <div className="flex flex-wrap gap-1">
      {ordered.map((role) => {
        if (role === "ADMIN") return <span key={role} className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">ADMIN</span>;
        if (role === "MANAGER") return <span key={role} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">MANAGER</span>;
        return <span key={role} className="rounded-full bg-[#f8ecd1] px-2 py-0.5 text-[10px] font-semibold text-[#800020]">USER</span>;
      })}
    </div>
  );
}

function ActiveBadge({ active }: Readonly<{ active: boolean }>) {
  return active
    ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Ativo</span>
    : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">Inativo</span>;
}


