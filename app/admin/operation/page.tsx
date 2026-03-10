import { AppShell } from "@/components/app-shell";
import { AdminOperationPanel } from "@/components/admin-operation-panel";
import { Card } from "@/components/ui/card";
import { requirePageUser } from "@/lib/page-auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type BrRow = {
  id: string | null;
  technical_id: string | null;
  name: string | null;
};

type SrRow = {
  id: string | null;
  technical_id: string | null;
  name: string | null;
  software_id: string | null;
};

type SwRow = {
  id: string | null;
  name: string | null;
};

export default async function AdminOperationPage() {
  const user = await requirePageUser("ADMIN");

  const [users, businessRolesRaw, systemRolesRaw, softwaresRaw, permissionIdsRaw] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        role: true,
        roleAssignments: {
          select: { role: true },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.$queryRaw<BrRow[]>`
      SELECT DISTINCT ON (id) id, technical_id, name
      FROM business_roles
      WHERE id IS NOT NULL
        AND lower(coalesce(is_current, 'false')) = 'true'
      ORDER BY id, updated_at DESC NULLS LAST, _row_id DESC
    `,
    db.$queryRaw<SrRow[]>`
      SELECT DISTINCT ON (id) id, technical_id, name, software_id
      FROM system_roles
      WHERE id IS NOT NULL
        AND lower(coalesce(is_current, 'false')) = 'true'
      ORDER BY id, updated_at DESC NULLS LAST, _row_id DESC
    `,
    db.$queryRaw<SwRow[]>`
      SELECT DISTINCT ON (id) id, name
      FROM softwares
      WHERE id IS NOT NULL
        AND lower(coalesce(is_current, 'false')) = 'true'
      ORDER BY id, updated_at DESC NULLS LAST, _row_id DESC
    `,
    db.permission.findMany({
      select: { id: true },
    }),
  ]);

  const permissionIds = new Set(permissionIdsRaw.map((item) => item.id));
  const softwareMap = new Map(softwaresRaw.filter((sw) => sw.id).map((sw) => [sw.id as string, toFriendlyLabel(sw.name, "Sem sistema")]));

  const businessRoles = businessRolesRaw
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id as string,
      label: toFriendlyLabel(item.name || item.technical_id, "Sem business role"),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const permissions = systemRolesRaw
    .filter((item) => item.id && permissionIds.has(item.id))
    .map((item) => ({
      id: item.id as string,
      label: toFriendlyLabel(item.name || item.technical_id, "Sem system role"),
      system: toFriendlyLabel(softwareMap.get(item.software_id || ""), "Sem sistema"),
    }))
    .sort((a, b) => (a.system + a.label).localeCompare(b.system + b.label));

  return (
    <AppShell
      user={user}
      title="Admin - Operacao"
      description="Acoes manuais para testes e operacao sem uso direto das ferramentas finais."
    >
      <Card className="mb-4 bg-[#fff8e8]">
        <p className="text-sm text-slate-700">
          Esta area suporta operacoes manuais de administracao: concessao e revogacao direta de SR em user, reconciliacao de BR e reconciliacao de SR.
          Todas as acoes sao auditadas.
        </p>
      </Card>
      <AdminOperationPanel users={users} businessRoles={businessRoles} permissions={permissions} />
    </AppShell>
  );
}

