import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { PaginationControls, parsePageParam, parsePageSizeParam } from "@/components/pagination-controls";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type SearchParams = Promise<{ q?: string; software?: string; current?: string; page?: string; pageSize?: string }>;

export default async function AdminSystemRolesPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const user = await requirePageUser("ADMIN");
  const params = await searchParams;
  const pageSize = parsePageSizeParam(params.pageSize);
  const page = parsePageParam(params.page, 1);

  const where: Prisma.OrchestratorSystemRoleWhereInput = {};
  if (params.q) {
    where.OR = [
      { id: { contains: params.q, mode: "insensitive" } },
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { technicalId: { contains: params.q, mode: "insensitive" } },
      { softwareId: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.software) where.softwareId = params.software;
  if (params.current === "true") where.isCurrent = { equals: "true", mode: "insensitive" };
  if (params.current === "false") where.isCurrent = { equals: "false", mode: "insensitive" };

  const totalRoles = await db.orchestratorSystemRole.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRoles / pageSize));
  const safePage = Math.min(page, totalPages);

  const [roles, softwares] = await Promise.all([
    db.orchestratorSystemRole.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { rowId: "desc" }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
    db.orchestratorSoftware.findMany({
      distinct: ["id"],
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const softwareNameById = new Map(softwares.filter((s) => s.id).map((s) => [s.id as string, s.name || "Sem nome"]));

  return (
    <AppShell user={user} title="Admin - System Roles" description="Consulta de papeis tecnicos importados do orquestrador.">
      <Card>
        <form className="mb-4 grid gap-3 rounded-xl border border-[#f1e6c9] bg-[#fff8e8]/40 p-3 md:grid-cols-4" method="get">
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Buscar por nome da role ou sistema"
            className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm"
          />
          <select name="software" defaultValue={params.software || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todos os systems</option>
            {softwares.map((item) => (
              <option key={item.id || "null"} value={item.id || ""}>
                {toFriendlyLabel(item.name, "Sem nome")}
              </option>
            ))}
          </select>
          <select name="current" defaultValue={params.current || ""} className="rounded-xl border border-[#e7d7ac] bg-white px-3 py-2 text-sm">
            <option value="">Todos</option>
            <option value="true">Current=true</option>
            <option value="false">Current=false</option>
          </select>
          <button className="rounded-xl bg-[#800020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#68001a]">Filtrar</button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-sky-100 bg-sky-50/30 p-2">
          <table className="min-w-full table-compact">
            <thead>
              <tr className="border-b border-[#f1e6c9] text-left text-[10px] uppercase tracking-wide text-slate-500">
                <th className="py-2">Nome</th>
                <th className="py-2">System</th>
                <th className="py-2">Description</th>
                <th className="py-2">Origin</th>
                <th className="py-2">Risk</th>
                <th className="py-2">Current</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((item) => (
                <tr key={item.rowId} className="border-b border-[#f7edd5] text-slate-800">
                  <td className="py-2">{toFriendlyLabel(item.name, "Sem nome")}</td>
                  <td className="py-2">{toFriendlyLabel(softwareNameById.get(item.softwareId || ""), "Sem sistema")}</td>
                  <td className="py-2">{toFriendlyLabel(item.description, "-")}</td>
                  <td className="py-2">{item.origin || "-"}</td>
                  <td className="py-2">
                    <RiskBadge risk={item.risk} />
                  </td>
                  <td className="py-2">
                    <CurrentBadge isCurrent={item.isCurrent} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          basePath="/admin/system-roles"
          page={safePage}
          pageSize={pageSize}
          totalItems={totalRoles}
          query={{ q: params.q, software: params.software, current: params.current }}
        />
      </Card>
    </AppShell>
  );
}

function CurrentBadge({ isCurrent }: Readonly<{ isCurrent: string | null }>) {
  const normalized = (isCurrent || "").toLowerCase();
  if (normalized === "true") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">true</span>;
  if (normalized === "false") return <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">false</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{isCurrent || "-"}</span>;
}

function RiskBadge({ risk }: Readonly<{ risk: string | null }>) {
  const normalized = (risk || "").toLowerCase();
  if (normalized.includes("high") || normalized.includes("alto")) {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{risk}</span>;
  }
  if (normalized.includes("med")) {
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{risk}</span>;
  }
  if (normalized.includes("low") || normalized.includes("baixo")) {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{risk}</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{risk || "-"}</span>;
}


