import { User } from "@prisma/client";
import { AppShellClient } from "@/components/app-shell-client";
import { db } from "@/lib/db";

type AppShellProps = Readonly<{
  user: User;
  title: string;
  description?: string;
  children: React.ReactNode;
}>;
type LinkIcon =
  | "home"
  | "access"
  | "requests"
  | "new-request"
  | "team"
  | "approvals"
  | "admin"
  | "user-management"
  | "my-systems"
  | "my-srs"
  | "my-brs"
  | "system-roles"
  | "assignment";

type ShellLink = {
  href: string;
  label: string;
  icon: LinkIcon;
  section: "personal" | "owner" | "management";
};

type ShellAlert = {
  id: string;
  title: string;
  description: string;
  tone: "critical" | "warning" | "info";
  href?: string;
};

function addMonths(base: Date, months: number) {
  const result = new Date(base);
  result.setMonth(result.getMonth() + months);
  return result;
}

const baseLinks: ShellLink[] = [
  { href: "/", label: "Overview", icon: "home", section: "personal" },
  { href: "/my-access", label: "Meus Acessos", icon: "access", section: "personal" },
  { href: "/request/new", label: "Nova Solicitacao", icon: "new-request", section: "personal" },
  { href: "/my-requests", label: "Minhas Solicitacoes", icon: "requests", section: "personal" },
];

export async function AppShell({ user, title, description, children }: AppShellProps) {
  const links: ShellLink[] = [...baseLinks];
  const alerts: ShellAlert[] = [];
  let directReportsCount = 0;
  let ownedSystemsCount = 0;
  let ownedPermissionsCount = 0;
  let ownedBrCount = 0;
  let controlledPermissionsCount = 0;

  try {
    [directReportsCount, ownedSystemsCount, ownedPermissionsCount, controlledPermissionsCount, ownedBrCount] = await Promise.all([
      db.user.count({
        where: {
          managerId: user.id,
          active: true,
        },
      }),
      db.system.count({ where: { ownerId: user.id } }),
      db.permission.count({ where: { ownerId: user.id } }),
      db.permission.count({
        where: {
          OR: [{ ownerId: user.id }, { system: { ownerId: user.id } }],
        },
      }),
      db.orchestratorBusinessRole.count({
        where: {
          ownerId: user.id,
          isCurrent: { equals: "true", mode: "insensitive" },
        },
      }),
    ]);
  } catch (error) {
    console.error("AppShell metrics fallback due to DB timeout:", error);
  }

  const hasManagerContext = user.role === "MANAGER" || (user.role === "ADMIN" && directReportsCount > 0);

  if (hasManagerContext) {
    links.push({ href: "/manager/team", label: "Meu Time", icon: "team", section: "owner" });
  }
  if (ownedBrCount > 0) {
    links.push({ href: "/my-brs", label: "Minhas BRs", icon: "my-brs", section: "owner" });
  }
  if (ownedSystemsCount > 0) {
    links.push({ href: "/my-systems", label: "Meus Sistemas", icon: "my-systems", section: "owner" });
  }
  if (controlledPermissionsCount > 0 || ownedPermissionsCount > 0) {
    links.push({ href: "/my-srs", label: "Minhas SRs", icon: "my-srs", section: "owner" });
  }

  if (user.role === "MANAGER" || user.role === "ADMIN") {
    links.push({ href: "/manager/approvals", label: "Aprovacoes", icon: "approvals", section: "owner" });
  }

  if (user.role === "ADMIN") {
    links.push({ href: "/admin", label: "Dashboard Admin", icon: "admin", section: "management" });
    links.push({ href: "/admin/requests", label: "Solicitacoes", icon: "requests", section: "management" });
    links.push({ href: "/admin/operation", label: "Operacoes", icon: "approvals", section: "management" });
    links.push({ href: "/admin/logs", label: "Logs", icon: "assignment", section: "management" });
    links.push({ href: "/admin/uar", label: "UAR", icon: "access", section: "management" });
    links.push({ href: "/admin/users", label: "Usuarios", icon: "user-management", section: "management" });
    links.push({ href: "/admin/systems", label: "Sistemas", icon: "my-systems", section: "management" });
    links.push({ href: "/admin/system-roles", label: "System Roles", icon: "system-roles", section: "management" });
    links.push({ href: "/admin/business-roles", label: "Business Roles", icon: "my-brs", section: "management" });
    links.push({ href: "/admin/assignment", label: "Assignment", icon: "assignment", section: "management" });
    links.push({ href: "/admin/scim", label: "SCIM", icon: "access", section: "management" });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(now.getDate() - 14);
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);
    const previous24HoursAgo = new Date(now);
    previous24HoursAgo.setHours(now.getHours() - 48);
    const thirtyMinutesAgo = new Date(now);
    thirtyMinutesAgo.setMinutes(now.getMinutes() - 30);
    const thirtyDaysAhead = new Date(now);
    thirtyDaysAhead.setDate(now.getDate() + 30);
    const sevenDaysAhead = new Date(now);
    sevenDaysAhead.setDate(now.getDate() + 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const oneYearAgo = new Date(now);
    oneYearAgo.setDate(now.getDate() - 370);

    const hasManagerAlerts = hasManagerContext || user.role === "ADMIN";
    const approvalsWhere =
      user.role === "ADMIN"
        ? { status: "PENDING_APPROVAL" as const }
        : { status: "PENDING_APPROVAL" as const, approverId: user.id };
    const managerRequestOr = [{ approverId: user.id }, { targetUser: { managerId: user.id } }];
    const managerScopeForRequests = user.role === "ADMIN" ? {} : { OR: managerRequestOr };
    const teamUserScope = user.role === "ADMIN" ? {} : { managerId: user.id };
    const delegationScope =
      user.role === "ADMIN"
        ? {}
        : {
            OR: [{ delegatorId: user.id }, { delegateId: user.id }],
          };

    const [
      pendingApprovals,
      pendingSlaRisk,
      criticalRejected,
      failedProvisioning24h,
      runningTooLong,
      criticalAccessGranted24h,
      directAssignments7d,
      directAssignmentsPrev7d,
      usersWithoutBusinessRole,
      ownerChangeEvents,
      srWithoutOwner,
      delegationExpiringSoon,
      deactivatedWithAccess,
      failures24h,
      failuresPrev24h,
      n8nWebhookFailures24h,
      scimTestFailure,
      scimSchemaFailure,
      lowTokenExpiration,
      broadDelegations,
    ] = await Promise.all([
      hasManagerAlerts ? db.accessRequest.count({ where: approvalsWhere }) : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessRequest.count({
            where: {
              ...approvalsWhere,
              createdAt: { lte: twentyFourHoursAgo },
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessApproval.count({
            where: {
              decision: "REJECTED",
              decidedAt: { gte: sevenDaysAgo },
              OR: [
                { comment: { contains: "critical", mode: "insensitive" } },
                { comment: { contains: "compliance", mode: "insensitive" } },
                { comment: { contains: "risco", mode: "insensitive" } },
                { request: { permission: { system: { criticality: "HIGH" } } } },
              ],
              ...(user.role === "ADMIN" ? {} : { approverId: user.id }),
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessExecution.count({
            where: {
              status: "FAILED",
              startedAt: { gte: twentyFourHoursAgo },
              ...(user.role === "ADMIN" ? {} : { request: { OR: managerRequestOr } }),
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessExecution.count({
            where: {
              status: "RUNNING",
              startedAt: { lte: thirtyMinutesAgo },
              ...(user.role === "ADMIN" ? {} : { request: { OR: managerRequestOr } }),
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessRequest.count({
            where: {
              status: "SUCCESS",
              createdAt: { gte: twentyFourHoursAgo },
              permission: { system: { criticality: "HIGH" } },
              ...(user.role === "ADMIN" ? {} : managerScopeForRequests),
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.userPermissionAssignment.count({
            where: {
              source: "DIRECT",
              createdAt: { gte: sevenDaysAgo },
              user: teamUserScope,
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.userPermissionAssignment.count({
            where: {
              source: "DIRECT",
              createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
              user: teamUserScope,
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.user.count({
            where: {
              ...teamUserScope,
              active: true,
              businessRoles: { none: {} },
            },
          })
        : Promise.resolve(0),
      user.role === "ADMIN"
        ? db.auditLog.count({
            where: {
              createdAt: { gte: thirtyDaysAgo },
              OR: [
                { action: { contains: "OWNER", mode: "insensitive" } },
                { action: { contains: "OWNERSHIP", mode: "insensitive" } },
              ],
            },
          })
        : Promise.resolve(0),
      user.role === "ADMIN" || ownedSystemsCount > 0 || ownedPermissionsCount > 0
        ? db.permission.count({
            where:
              user.role === "ADMIN"
                ? { ownerId: null }
                : { ownerId: null, OR: [{ system: { ownerId: user.id } }, { ownerId: user.id }] },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.approvalDelegation.count({
            where: {
              active: true,
              endsAt: { gte: now, lte: sevenDaysAhead },
              ...delegationScope,
            },
          })
        : Promise.resolve(0),
      user.role === "ADMIN"
        ? db.user.count({
            where: {
              active: false,
              permissionSnapshot: { some: {} },
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessExecution.count({
            where: {
              status: "FAILED",
              startedAt: { gte: twentyFourHoursAgo },
              ...(user.role === "ADMIN" ? {} : { request: { OR: managerRequestOr } }),
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessExecution.count({
            where: {
              status: "FAILED",
              startedAt: { gte: previous24HoursAgo, lt: twentyFourHoursAgo },
              ...(user.role === "ADMIN" ? {} : { request: { OR: managerRequestOr } }),
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.accessExecution.count({
            where: {
              status: "FAILED",
              startedAt: { gte: twentyFourHoursAgo },
              OR: [
                { errorMessage: { contains: "n8n", mode: "insensitive" } },
                { errorMessage: { contains: "webhook", mode: "insensitive" } },
              ],
              ...(user.role === "ADMIN" ? {} : { request: { OR: managerRequestOr } }),
            },
          })
        : Promise.resolve(0),
      user.role === "ADMIN" ? db.scimSettings.count({ where: { lastTestStatus: "error" } }) : Promise.resolve(0),
      user.role === "ADMIN" ? db.scimSettings.count({ where: { lastSchemaValidationStatus: "error" } }) : Promise.resolve(0),
      user.role === "ADMIN"
        ? db.scimSettings.count({
            where: {
              tokenExpiration: { not: null, lte: 1440, gt: 0 },
            },
          })
        : Promise.resolve(0),
      hasManagerAlerts
        ? db.approvalDelegation.findMany({
            where: {
              active: true,
              scope: "ANY",
              ...delegationScope,
            },
            select: { startsAt: true, endsAt: true },
            take: 500,
          })
        : Promise.resolve([]),
    ]);

    let revocationsIn30d = 0;
    if (hasManagerAlerts) {
      const requestRows = await db.accessRequest.findMany({
        where: {
          status: { in: ["APPROVED", "RUNNING", "SUCCESS"] },
          createdAt: { gte: oneYearAgo },
          ...(user.role === "ADMIN" ? {} : managerScopeForRequests),
        },
        select: {
          id: true,
          targetUserId: true,
          permissionId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 3000,
      });

      const requestIds = requestRows.map((row) => row.id);
      if (requestIds.length > 0) {
        const auditRows = await db.auditLog.findMany({
          where: {
            entityType: "AccessRequest",
            entityId: { in: requestIds },
            action: { in: ["REQUEST_CREATED", "REQUEST_CREATED_MIRROR"] },
          },
          select: {
            entityId: true,
            details: true,
          },
          orderBy: { createdAt: "desc" },
        });

        const durationByRequest = new Map<string, number>();
        for (const row of auditRows) {
          const details = row.details;
          if (!details || Array.isArray(details) || typeof details !== "object") continue;
          const durationValue = (details as Record<string, unknown>).accessDurationMonths;
          if (typeof durationValue === "number" && [1, 3, 6, 12].includes(durationValue)) {
            durationByRequest.set(row.entityId, durationValue);
          }
        }

        const latestByPermissionAndUser = new Map<string, { createdAt: Date; durationMonths: number }>();
        for (const row of requestRows) {
          const durationMonths = durationByRequest.get(row.id);
          if (!durationMonths) continue;
          const key = `${row.permissionId}::${row.targetUserId}`;
          if (latestByPermissionAndUser.has(key)) continue;
          latestByPermissionAndUser.set(key, {
            createdAt: row.createdAt,
            durationMonths,
          });
        }

        for (const item of latestByPermissionAndUser.values()) {
          const expiresAt = addMonths(item.createdAt, item.durationMonths);
          if (expiresAt >= now && expiresAt <= thirtyDaysAhead) {
            revocationsIn30d += 1;
          }
        }
      }
    }

    const broadDelegationCount = broadDelegations.filter((item) => item.endsAt.getTime() - item.startsAt.getTime() > 30 * 24 * 60 * 60 * 1000).length;

    if (pendingApprovals > 0) {
      alerts.push({
        id: "pending-approvals",
        title: "Solicitacoes pendentes de aprovacao",
        description: `${pendingApprovals} solicitacao(oes) aguardando decisao.`,
        tone: "warning",
        href: "/manager/approvals",
      });
    }

    if (pendingSlaRisk > 0) {
      alerts.push({
        id: "sla-risk",
        title: "Solicitacoes proximas do SLA",
        description: `${pendingSlaRisk} pendencia(s) aberta(s) ha mais de 24h.`,
        tone: "warning",
        href: "/manager/approvals",
      });
    }

    if (criticalRejected > 0) {
      alerts.push({
        id: "critical-rejections",
        title: "Reprovacoes criticas/compliance",
        description: `${criticalRejected} caso(s) relevante(s) nos ultimos 7 dias.`,
        tone: "info",
        href: "/my-requests",
      });
    }

    if (failedProvisioning24h > 0) {
      alerts.push({
        id: "failed-provisioning",
        title: "Falha de provisionamento",
        description: `${failedProvisioning24h} execucao(oes) com status FAILED nas ultimas 24h.`,
        tone: "critical",
        href: "/admin/requests",
      });
    }

    if (runningTooLong > 0) {
      alerts.push({
        id: "stuck-running",
        title: "Execucao travada",
        description: `${runningTooLong} execucao(oes) RUNNING ha mais de 30 minutos.`,
        tone: "warning",
        href: "/admin/requests",
      });
    }

    if (criticalAccessGranted24h > 0) {
      alerts.push({
        id: "critical-grants",
        title: "Acesso em sistema critico",
        description: `${criticalAccessGranted24h} concessao(oes) em sistemas HIGH nas ultimas 24h.`,
        tone: "warning",
        href: "/my-access",
      });
    }

    if (directAssignments7d > 0) {
      alerts.push({
        id: "direct-access-granted",
        title: "Acessos adicionais concedidos",
        description: `${directAssignments7d} acesso(s) DIRECT concedido(s) nos ultimos 7 dias.`,
        tone: "info",
        href: hasManagerAlerts ? "/manager/team" : "/my-access",
      });
    }

    if (revocationsIn30d > 0) {
      alerts.push({
        id: "revocations-near",
        title: "Revogacoes proximas",
        description: `${revocationsIn30d} acesso(s) direto(s) expira(m) em ate 30 dias.`,
        tone: "warning",
        href: "/my-access",
      });
    }

    if (usersWithoutBusinessRole > 0) {
      alerts.push({
        id: "users-without-br",
        title: "Usuarios sem Business Role",
        description: `${usersWithoutBusinessRole} liderado(s) ativo(s) sem BR vinculada.`,
        tone: "info",
        href: "/manager/team",
      });
    }

    if (directAssignments7d >= 5 && directAssignments7d > directAssignmentsPrev7d * 1.5) {
      alerts.push({
        id: "exceptions-spike",
        title: "Aumento anomalo de excecoes",
        description: `Acessos DIRECT subiram de ${directAssignmentsPrev7d} para ${directAssignments7d} na comparacao semanal.`,
        tone: "warning",
        href: "/manager/team",
      });
    }

    if (ownerChangeEvents > 0) {
      alerts.push({
        id: "owner-change",
        title: "Mudancas de ownership",
        description: `${ownerChangeEvents} evento(s) de ownership registrado(s) em 30 dias.`,
        tone: "info",
        href: "/admin/operation",
      });
    }

    if (srWithoutOwner > 0) {
      alerts.push({
        id: "sr-without-owner",
        title: "SR sem owner definido",
        description: `${srWithoutOwner} SR(s) sem owner.`,
        tone: "warning",
        href: "/admin/system-roles",
      });
    }

    if (delegationExpiringSoon > 0) {
      alerts.push({
        id: "delegation-expiring",
        title: "Delegacao perto de expirar",
        description: `${delegationExpiringSoon} delegacao(oes) encerra(m) em ate 7 dias.`,
        tone: "info",
        href: "/manager/approvals",
      });
    }

    if (broadDelegationCount > 0) {
      alerts.push({
        id: "delegation-policy",
        title: "Delegacao fora da politica",
        description: `${broadDelegationCount} delegacao(oes) amplas (scope ANY) acima de 30 dias.`,
        tone: "warning",
        href: "/manager/approvals",
      });
    }

    if (scimTestFailure > 0) {
      alerts.push({
        id: "scim-test-failed",
        title: "Falha no teste SCIM",
        description: `${scimTestFailure} ambiente(s) com ultimo teste SCIM em erro.`,
        tone: "critical",
        href: "/admin/scim",
      });
    }

    if (scimSchemaFailure > 0) {
      alerts.push({
        id: "scim-schema-failed",
        title: "Schema SCIM incompativel",
        description: `${scimSchemaFailure} ambiente(s) com validacao de schema em erro.`,
        tone: "critical",
        href: "/admin/scim",
      });
    }

    if (lowTokenExpiration > 0) {
      alerts.push({
        id: "scim-token-expiring",
        title: "Token SCIM com expiracao curta",
        description: `${lowTokenExpiration} configuracao(oes) com token_expiration <= 24h.`,
        tone: "warning",
        href: "/admin/scim",
      });
    }

    if (n8nWebhookFailures24h >= 3) {
      alerts.push({
        id: "n8n-webhook-failure",
        title: "Falha recorrente no webhook n8n",
        description: `${n8nWebhookFailures24h} falha(s) com indicio de n8n/webhook nas ultimas 24h.`,
        tone: "critical",
        href: "/admin/requests",
      });
    }

    if (deactivatedWithAccess > 0) {
      alerts.push({
        id: "inactive-with-access",
        title: "Usuario inativo com acesso ativo",
        description: `${deactivatedWithAccess} usuario(s) inativo(s) ainda com permissoes.`,
        tone: "critical",
        href: "/admin/users",
      });
    }

    if (failures24h >= 3 && failures24h > failuresPrev24h * 1.5) {
      alerts.push({
        id: "recent-failures-spike",
        title: "Pico de falhas recentes",
        description: `Falhas subiram de ${failuresPrev24h} para ${failures24h} (janela de 24h).`,
        tone: "critical",
        href: "/admin/requests",
      });
    }
  } catch (error) {
    console.error("AppShell alerts fallback due to DB timeout:", error);
  }

  return (
    <AppShellClient user={{ name: user.name, email: user.email, role: user.role }} title={title} description={description} links={links} alerts={alerts}>
      {children}
    </AppShellClient>
  );
}

