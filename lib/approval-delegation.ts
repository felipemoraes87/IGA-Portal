import { ApprovalDelegationScope, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type DelegationScope = Exclude<ApprovalDelegationScope, "ANY">;

type DelegationContext = {
  delegatorId: string;
  scope: DelegationScope;
  systemId?: string | null;
  permissionId?: string | null;
  at?: Date;
};

type RequestApproverContext = {
  approverId: string | null;
  permissionId: string;
  permission: {
    ownerId: string | null;
    systemId: string;
    system: { ownerId: string | null };
  };
};

type PermissionApproverContext = {
  ownerId: string | null;
  systemId: string;
  system: { ownerId: string | null };
};

export function resolvePrimaryApproverForPermission(permission: PermissionApproverContext) {
  if (permission.ownerId) {
    return {
      approverId: permission.ownerId,
      scope: "SR_OWNER" as const,
    };
  }

  if (permission.system.ownerId) {
    return {
      approverId: permission.system.ownerId,
      scope: "SYSTEM_OWNER" as const,
    };
  }

  return {
    approverId: null,
    scope: null,
  };
}

export function inferRequestApproverScope(request: RequestApproverContext): DelegationScope {
  if (request.approverId && request.approverId === request.permission.ownerId) {
    return "SR_OWNER";
  }
  if (request.approverId && request.approverId === request.permission.system.ownerId) {
    return "SYSTEM_OWNER";
  }
  return "MANAGER";
}

function scoreDelegationMatch(
  delegation: { scope: ApprovalDelegationScope; permissionId: string | null; systemId: string | null; createdAt: Date },
  context: Required<Pick<DelegationContext, "scope">> & Pick<DelegationContext, "permissionId" | "systemId">,
) {
  let score = 0;
  if (delegation.scope === context.scope) score += 8;
  if (context.permissionId && delegation.permissionId === context.permissionId) score += 16;
  if (context.systemId && delegation.systemId === context.systemId) score += 4;
  return score;
}

export async function resolveDelegatedApprover(context: DelegationContext) {
  const at = context.at ?? new Date();
  const where: Prisma.ApprovalDelegationWhereInput = {
    active: true,
    delegatorId: context.delegatorId,
    startsAt: { lte: at },
    endsAt: { gte: at },
    scope: { in: ["ANY", context.scope] },
    delegate: { active: true },
    AND: [
      context.permissionId
        ? { OR: [{ permissionId: null }, { permissionId: context.permissionId }] }
        : { permissionId: null },
      context.systemId ? { OR: [{ systemId: null }, { systemId: context.systemId }] } : { systemId: null },
    ],
  };

  const delegations = await db.approvalDelegation.findMany({
    where,
    select: {
      id: true,
      delegateId: true,
      scope: true,
      systemId: true,
      permissionId: true,
      createdAt: true,
    },
  });

  if (!delegations.length) return null;

  delegations.sort((a, b) => {
    const aScore = scoreDelegationMatch(a, context);
    const bScore = scoreDelegationMatch(b, context);
    if (aScore !== bScore) return bScore - aScore;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return delegations[0];
}

export async function resolveEffectiveApprover(context: DelegationContext) {
  const delegation = await resolveDelegatedApprover(context);
  if (!delegation) {
    return {
      effectiveApproverId: context.delegatorId,
      delegationId: null,
    };
  }

  return {
    effectiveApproverId: delegation.delegateId,
    delegationId: delegation.id,
  };
}

export async function canActAsRequestApprover(userId: string, request: RequestApproverContext) {
  if (!request.approverId) {
    return { allowed: false as const, delegationId: null as string | null };
  }

  if (request.approverId === userId) {
    return { allowed: true as const, delegationId: null as string | null };
  }

  const scope = inferRequestApproverScope(request);
  const delegation = await resolveDelegatedApprover({
    delegatorId: request.approverId,
    scope,
    permissionId: request.permissionId,
    systemId: request.permission.systemId,
  });

  if (delegation?.delegateId === userId) {
    return { allowed: true as const, delegationId: delegation.id };
  }

  return { allowed: false as const, delegationId: null as string | null };
}
