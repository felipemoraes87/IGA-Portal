import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { resolveSystemThumb } from "@/lib/system-logo";
import { toFriendlyLabel } from "@/lib/utils";

export default async function ManagerTeamPage() {
  const user = await requirePageUser("MANAGER");
  const members = await db.user.findMany({
    where: {
      active: true,
      managerId: user.id,
    },
    include: {
      permissionSnapshot: {
        where: {
          source: {
            not: "BR",
          },
        },
        include: { permission: { include: { system: true } } },
      },
      businessRoles: {
        include: {
          businessRole: {
            include: {
              permissions: { include: { permission: { include: { system: true } } } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const activeReportsCount = members.length;
  const membersWithBusinessRole = members.filter((member) => member.businessRoles.length > 0).length;
  const membersWithAdditionalAccess = members.filter((member) => member.permissionSnapshot.length > 0).length;
  const totalAdditionalAccesses = members.reduce((sum, member) => sum + member.permissionSnapshot.length, 0);

  const criticalAccesses = members.reduce((sum, member) => {
    const criticalPermissionIds = new Set<string>();

    for (const assignment of member.permissionSnapshot) {
      if (assignment.permission.system.criticality === "HIGH") {
        criticalPermissionIds.add(assignment.permission.id);
      }
    }

    for (const businessRoleLink of member.businessRoles) {
      for (const permissionLink of businessRoleLink.businessRole.permissions) {
        if (permissionLink.permission.system.criticality === "HIGH") {
          criticalPermissionIds.add(permissionLink.permission.id);
        }
      }
    }

    return sum + criticalPermissionIds.size;
  }, 0);

  const cardNotes = [
    {
      title: "Liderados ativos",
      description: "Total de colaboradores ativos que respondem diretamente para voce.",
    },
    {
      title: "Com Business Role",
      description: "Quantidade de liderados com pelo menos uma Business Role atribuida.",
    },
    {
      title: "Com acesso adicional",
      description: "Quantidade de liderados com acessos fora de Business Role (excecoes).",
    },
    {
      title: "Total de excecoes",
      description: "Soma de todos os acessos adicionais do time.",
    },
    {
      title: "Acessos criticos",
      description: "Total de acessos em sistemas classificados como criticidade HIGH.",
    },
  ] as const;

  const titleWithHelp = (title: string, help: string) => (
    <span className="inline-flex items-center gap-1">
      <span>{title}</span>
      <span
        title={help}
        aria-label={help}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500"
      >
        ?
      </span>
    </span>
  );

  return (
    <AppShell user={user} title="Meus Liderados" description="Visibilidade de acessos atuais, Business Roles e permissÃµes efetivas derivadas.">
      <div className="space-y-4">
        <section className="grid gap-4 md:grid-cols-5">
          <Card className="border-slate-200">
            <p className="text-sm text-slate-500">{titleWithHelp("Liderados ativos", cardNotes[0].description)}</p>
            <p className="mt-1 text-3xl font-bold text-[#800020]">{activeReportsCount}</p>
          </Card>
          <Card className="border-slate-200">
            <p className="text-sm text-slate-500">{titleWithHelp("Com Business Role", cardNotes[1].description)}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{membersWithBusinessRole}</p>
          </Card>
          <Card className="border-slate-200">
            <p className="text-sm text-slate-500">{titleWithHelp("Com acesso adicional", cardNotes[2].description)}</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{membersWithAdditionalAccess}</p>
          </Card>
          <Card className="border-slate-200">
            <p className="text-sm text-slate-500">{titleWithHelp("Total de excecoes", cardNotes[3].description)}</p>
            <p className="mt-1 text-3xl font-bold text-amber-600">{totalAdditionalAccesses}</p>
          </Card>
          <Card className="border-slate-200">
            <p className="text-sm text-slate-500">{titleWithHelp("Acessos criticos", cardNotes[4].description)}</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{criticalAccesses}</p>
          </Card>
        </section>

        {members.map((member) => (
          <Card key={member.id}>
            <h3 className="text-lg font-bold text-slate-900">{member.name}</h3>
            <p className="text-sm text-slate-500">{member.email}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Business Roles</p>
                <div className="mt-2 space-y-2">
                  {member.businessRoles.map((link) => (
                    <details key={link.id} className="rounded-xl border border-[#f1e6c9] bg-[#fff8e8] p-2">
                      <summary className="cursor-pointer text-sm font-semibold text-[#4a0012]">{toFriendlyLabel(link.businessRole.name, "Sem business role")}</summary>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {link.businessRole.permissions.map((permissionLink) => (
                          <li key={permissionLink.id} className="flex items-center gap-2">
                            <img src={resolveSystemThumb(permissionLink.permission.system.name)} alt={`${permissionLink.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                            <span>{toFriendlyLabel(permissionLink.permission.system.name, "Sem sistema")} - {toFriendlyLabel(permissionLink.permission.name, "Sem role")}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ))}
                  {member.businessRoles.length === 0 ? <p className="text-sm text-slate-500">Sem business roles.</p> : null}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Acessos adicionais</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {member.permissionSnapshot.map((assignment) => (
                    <li key={assignment.id} className="flex items-center gap-2">
                      <img src={resolveSystemThumb(assignment.permission.system.name)} alt={`${assignment.permission.system.name} logo`} className="h-4 w-4 rounded-sm border border-[#e7d7ac] bg-white p-0.5" />
                      <span>{toFriendlyLabel(assignment.permission.system.name, "Sem sistema")} - {toFriendlyLabel(assignment.permission.name, "Sem role")} ({assignment.source})</span>
                    </li>
                  ))}
                  {member.permissionSnapshot.length === 0 ? <li>Nenhum acesso adicional.</li> : null}
                </ul>
              </div>
            </div>
          </Card>
        ))}
        {members.length === 0 ? <Card>Nenhum liderado encontrado.</Card> : null}
      </div>
    </AppShell>
  );
}

