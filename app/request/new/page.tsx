import { AppShell } from "@/components/app-shell";
import { NewRequestForm } from "@/components/new-request-form";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/page-auth";

export default async function NewRequestPage() {
  const user = await requirePageUser("USER");
  const permissions = await db.permission.findMany({
    include: { system: true },
    orderBy: [{ system: { name: "asc" } }, { name: "asc" }],
  });

  const users = await db.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const mirrorUsers = await db.user.findMany({
    where: {
      active: true,
      permissionSnapshot: {
        some: {
          source: "DIRECT",
        },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const systemsMap = new Map<
    string,
    {
      id: string;
      name: string;
      permissions: { id: string; name: string; description?: string }[];
    }
  >();

  for (const permission of permissions) {
    const existing = systemsMap.get(permission.system.id);
    if (existing) {
      existing.permissions.push({
        id: permission.id,
        name: permission.name,
        description: permission.description || undefined,
      });
    } else {
      systemsMap.set(permission.system.id, {
        id: permission.system.id,
        name: permission.system.name,
        permissions: [
          {
            id: permission.id,
            name: permission.name,
            description: permission.description || undefined,
          },
        ],
      });
    }
  }

  const systems = [...systemsMap.values()];

  return (
    <AppShell
      user={user}
      title="Nova Solicitacao"
      description="Fluxo guiado para selecionar sistemas, papeis e justificativa de acesso."
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <StepperItem number={1} label="Usuario" active />
            <StepperLine />
            <StepperItem number={2} label="Sistemas e Papeis" active />
            <StepperLine />
            <StepperItem number={3} label="Justificativa" />
            <StepperLine />
            <StepperItem number={4} label="Revisao" />
          </div>
        </div>

        <Card className="max-w-7xl border-slate-200">
          <NewRequestForm
            actorRole={user.role}
            actorUserId={user.id}
            users={users.map((item) => ({
              id: item.id,
              label: `${item.name} (${item.email})`,
            }))}
            mirrorUsers={mirrorUsers.map((item) => ({
              id: item.id,
              label: `${item.name} (${item.email})`,
            }))}
            systems={systems}
          />
        </Card>
      </div>
    </AppShell>
  );
}

function StepperItem({ number, label, active = false }: Readonly<{ number: number; label: string; active?: boolean }>) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${active ? "bg-[#800020] text-white" : "bg-slate-200 text-slate-500"}`}>
        {number}
      </div>
      <span className={`text-sm font-semibold ${active ? "text-[#800020]" : "text-slate-500"}`}>{label}</span>
    </div>
  );
}

function StepperLine() {
  return <div className="hidden h-px flex-1 bg-slate-200 md:block" />;
}
