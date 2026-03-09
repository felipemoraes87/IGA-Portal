import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { UserManagementSubnav } from "@/components/user-management-subnav";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { SCIM_ADMIN_GROUP } from "@/lib/scim";

const MAPPED_KC_GROUPS = [SCIM_ADMIN_GROUP];

function maskToken(token?: string) {
  if (!token) return "Nao configurado";
  if (token.length <= 8) return "Configurado";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

type SearchParams = Promise<{ page?: string; pageSize?: string }>;

export default async function AdminUserManagementPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);
  const totalUsers = await db.user.count();
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const safePage = Math.min(page, totalPages);

  const [users, totalProvisioned] = await Promise.all([
    db.user.findMany({
      include: {
        scimGroups: true,
        roleAssignments: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
    db.user.count({
      where: {
        externalId: { not: null },
      },
    }),
  ]);

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const scimBaseUrl = `${appUrl.replace(/\/$/, "")}/api/scim/v2`;
  const scimToken = process.env.SCIM_BEARER_TOKEN;

  return (
    <AppShell
      user={user}
      title="Admin - User Management"
      description="Usuarios provisionados via SCIM e papel efetivo calculado por grupo/diretos."
    >
      <UserManagementSubnav active="users" />

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Configuracao SCIM</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-lg border border-[#f1e6c9] bg-[#fff8e8] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Base URL</p>
            <p className="font-mono text-slate-800">{scimBaseUrl}</p>
          </div>
          <div className="rounded-lg border border-[#f1e6c9] bg-[#fff8e8] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Bearer Token</p>
            <p className="font-mono text-slate-800">{maskToken(scimToken)}</p>
          </div>
          <div className="rounded-lg border border-[#f1e6c9] bg-[#fff8e8] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Grupo Admin (Keycloak)</p>
            <p className="font-mono text-slate-800">{SCIM_ADMIN_GROUP}</p>
          </div>
          <div className="rounded-lg border border-[#f1e6c9] bg-[#fff8e8] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Grupos mapeados (SCIM)</p>
            <p className="font-mono text-slate-800">{MAPPED_KC_GROUPS.join(", ")}</p>
          </div>
          <div className="rounded-lg border border-[#f1e6c9] bg-[#fff8e8] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Provisionados (externalId)</p>
            <p className="text-slate-800">{totalProvisioned}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Usuarios Provisionados</h2>
        <p className="mt-1 text-xs text-slate-500">Precedencia de perfil: ADMIN &gt; MANAGER &gt; USER.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-[#f1e6c9] text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2">Nome</th>
                <th className="py-2">Email</th>
                <th className="py-2">External ID</th>
                <th className="py-2">Perfil</th>
                <th className="py-2">Status</th>
                <th className="py-2">Grupos KC (mapeados)</th>
                <th className="py-2">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id} className="border-b border-[#f7edd5] text-slate-800">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.email}</td>
                  <td className="py-2 font-mono text-xs">{item.externalId || "-"}</td>
                  <td className="py-2">
                    <RoleBadges roles={item.roleAssignments.map((assignment) => assignment.role)} fallbackRole={item.role} />
                  </td>
                  <td className="py-2">{item.active ? "Ativo" : "Inativo"}</td>
                  <td className="py-2">
                    {(() => {
                      const mapped = item.scimGroups
                        .map((group) => group.value)
                        .filter((group) => MAPPED_KC_GROUPS.includes(group));
                      return mapped.length ? mapped.join(", ") : "-";
                    })()}
                  </td>
                  <td className="py-2">{item.updatedAt.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/admin/user-management"
          page={safePage}
          pageSize={pageSize}
          totalItems={totalUsers}
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
      {ordered.map((role) => (
        <span
          key={role}
          className={
            role === "ADMIN"
              ? "rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700"
              : role === "MANAGER"
                ? "rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                : "rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
          }
        >
          {role}
        </span>
      ))}
    </div>
  );
}

