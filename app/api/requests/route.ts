import { randomUUID } from "crypto";
import { AccessRequestStatus, Prisma, User } from "@prisma/client";
import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendRequestToN8N } from "@/lib/n8n";
import { writeAuditLog } from "@/lib/audit";
import { requestSchema } from "@/lib/validation";
import { resolveEffectiveApprover, resolvePrimaryApproverForPermission } from "@/lib/approval-delegation";

const validStatuses: AccessRequestStatus[] = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "RUNNING", "SUCCESS", "FAILED"];

type RequestInput = Prisma.JsonObject & {
  requestType: "SINGLE" | "MIRROR";
  targetUserId: string;
  permissionId?: string;
  permissionIds?: string[];
  mirrorFromUserId?: string;
  accessDurationMonths?: 1 | 3 | 6 | 12;
  accessDurationByPermissionId?: Record<string, 1 | 3 | 6 | 12>;
  justification: string;
};

type CreatedRequestItem = {
  request: {
    id: string;
    justification: string;
    idempotencyKey: string;
  };
  accessDurationMonths?: 1 | 3 | 6 | 12;
  permission: {
    id: string;
    name: string;
    system: { name: string };
  };
};

type PermissionWithApproverContext = {
  id: string;
  name: string;
  systemId: string;
  ownerId: string | null;
  system: { name: string; ownerId: string | null };
};

type ErrorResult = { error: NextResponse };
type CollectPermissionResult = { uniquePermissionIds: string[]; mirrorSource: User | null } | ErrorResult;
type MirrorPermissionResult = { mirrorSource: User; permissionIds: string[] } | ErrorResult;

export function canManageUser(actor: User, target: User) {
  return (actor.active ?? true) && (target.active ?? true);
}

async function dispatchN8nAndHandleFailures(args: {
  requestId: string;
  targetEmail: string;
  permissionName: string;
  systemName: string;
  justification: string;
  accessDurationMonths?: 1 | 3 | 6 | 12;
  idempotencyKey: string;
  actorEmail: string;
}) {
  try {
    await sendRequestToN8N({
      request_id: args.requestId,
      target_user: args.targetEmail,
      permission: args.permissionName,
      system: args.systemName,
      action: "GRANT_ACCESS",
      justification: args.justification,
      access_duration_months: args.accessDurationMonths,
      idempotency_key: args.idempotencyKey,
      actor: args.actorEmail,
    });
  } catch (error) {
    console.error(error);
    await db.accessRequest.update({
      where: { id: args.requestId },
      data: {
        status: "FAILED",
        execution: {
          update: {
            status: "FAILED",
            errorMessage: "Failed to dispatch n8n webhook",
            finishedAt: new Date(),
          },
        },
      },
    });
  }
}

export function buildRequestFilters(
  user: User,
  status: string | null,
  system: string | null,
): Prisma.AccessRequestWhereInput {
  const where: Prisma.AccessRequestWhereInput = {};
  if (status && validStatuses.includes(status as AccessRequestStatus)) {
    where.status = status as AccessRequestStatus;
  }
  if (system) where.permission = { system: { name: system } };

  if (user.role === "USER") {
    where.requesterId = user.id;
  }
  if (user.role === "MANAGER") {
    where.OR = [{ requesterId: user.id }, { approverId: user.id }, { targetUser: { managerId: user.id } }];
  }

  return where;
}

async function resolveTargetUser(actor: User, input: RequestInput) {
  const targetUser = await db.user.findUnique({ where: { id: input.targetUserId } });
  if (!targetUser?.active) {
    return { error: NextResponse.json({ error: "Target user not found" }, { status: 404 }) };
  }

  if (!canManageUser(actor, targetUser)) {
    return { error: NextResponse.json({ error: "Forbidden for target user" }, { status: 403 }) };
  }

  const autoApprove = actor.role === "ADMIN";

  return { targetUser, autoApprove };
}

async function collectPermissionIds(input: RequestInput, targetUserId: string): Promise<CollectPermissionResult> {
  const targetCurrentAssignments = await db.userPermissionAssignment.findMany({
    where: { userId: targetUserId },
    select: { permissionId: true },
  });
  const targetPermissionIds = new Set(targetCurrentAssignments.map((item) => item.permissionId));

  const toRequestPermissionIds: string[] = [];
  let mirrorSource: User | null = null;

  if (input.requestType === "SINGLE") {
    const selectedPermissions = getSingleRequestPermissionIds(input);
    if (!selectedPermissions.length) {
      return { error: NextResponse.json({ error: "permissionId is required" }, { status: 400 }) };
    }
    toRequestPermissionIds.push(...selectedPermissions);
  } else {
    const mirrorData = await getMirrorRequestPermissionIds(input, targetPermissionIds);
    if ("error" in mirrorData) return { error: mirrorData.error };
    mirrorSource = mirrorData.mirrorSource;
    toRequestPermissionIds.push(...mirrorData.permissionIds);
  }

  const uniquePermissionIds = [...new Set(toRequestPermissionIds)];
  if (!uniquePermissionIds.length) {
    return {
      error: NextResponse.json(
        { error: "No additional direct accesses available to request for this target user" },
        { status: 400 },
      ),
    };
  }

  return { uniquePermissionIds, mirrorSource };
}

export function getSingleRequestPermissionIds(input: RequestInput) {
  return [...(input.permissionId ? [input.permissionId] : []), ...(input.permissionIds ?? [])];
}

async function getMirrorRequestPermissionIds(
  input: RequestInput,
  targetPermissionIds: Set<string>,
): Promise<MirrorPermissionResult> {
  if (!input.mirrorFromUserId) {
    return { error: NextResponse.json({ error: "mirrorFromUserId is required" }, { status: 400 }) };
  }

  const mirrorSource = await db.user.findUnique({ where: { id: input.mirrorFromUserId } });
  if (!mirrorSource?.active) {
    return { error: NextResponse.json({ error: "Mirror source user not found" }, { status: 404 }) };
  }

  const mirrorAssignments = await db.userPermissionAssignment.findMany({
    where: { userId: mirrorSource.id, source: "DIRECT" },
    select: { permissionId: true },
  });

  const permissionIds = mirrorAssignments
    .map((assignment) => assignment.permissionId)
    .filter((permissionId) => !targetPermissionIds.has(permissionId));

  return { mirrorSource, permissionIds };
}

async function loadPermissions(uniquePermissionIds: string[]) {
  const permissions = await db.permission.findMany({
    where: { id: { in: uniquePermissionIds } },
    include: {
      system: {
        select: {
          name: true,
          ownerId: true,
        },
      },
    },
  });
  if (permissions.length !== uniquePermissionIds.length) {
    return { error: NextResponse.json({ error: "One or more permissions were not found" }, { status: 404 }) };
  }
  return { permissionMap: new Map(permissions.map((permission) => [permission.id, permission])) };
}

export function resolvePermissionApproverId(permission: PermissionWithApproverContext) {
  return resolvePrimaryApproverForPermission(permission).approverId;
}

function getPermissionsMissingOwner(
  permissionIds: string[],
  permissionMap: Map<string, PermissionWithApproverContext>,
) {
  return permissionIds.filter((permissionId) => {
    const permission = permissionMap.get(permissionId);
    if (!permission) return false;
    return !resolvePermissionApproverId(permission);
  });
}

function resolveAccessDurationMonthsForPermission(input: RequestInput, permissionId: string) {
  if (input.requestType !== "SINGLE") return undefined;
  return input.accessDurationByPermissionId?.[permissionId] ?? input.accessDurationMonths ?? 6;
}

type ApproverResolution = {
  effectiveApproverId: string;
  delegationId: string | null;
  delegatedFromApproverId: string | null;
};

async function resolveRequestApprover(args: {
  actor: User;
  autoApprove: boolean;
  permission: PermissionWithApproverContext;
}): Promise<ApproverResolution | null> {
  if (args.autoApprove) {
    return {
      effectiveApproverId: args.actor.id,
      delegationId: null,
      delegatedFromApproverId: null,
    };
  }

  const primary = resolvePrimaryApproverForPermission(args.permission);
  if (!primary.approverId || !primary.scope) return null;

  const resolved = await resolveEffectiveApprover({
    delegatorId: primary.approverId,
    scope: primary.scope,
    systemId: args.permission.systemId,
    permissionId: args.permission.id,
  });

  return {
    effectiveApproverId: resolved.effectiveApproverId,
    delegationId: resolved.delegationId,
    delegatedFromApproverId: resolved.delegationId ? primary.approverId : null,
  };
}

async function createAccessRequestRecord(args: {
  actor: User;
  targetUser: User;
  autoApprove: boolean;
  input: RequestInput;
  permission: PermissionWithApproverContext;
  accessDurationMonths?: 1 | 3 | 6 | 12;
  approver: ApproverResolution;
}) {
  const idempotencyKey = randomUUID();
  const created = await db.accessRequest.create({
    data: {
      requesterId: args.actor.id,
      targetUserId: args.targetUser.id,
      permissionId: args.permission.id,
      justification: args.input.justification,
      status: args.autoApprove ? "RUNNING" : "PENDING_APPROVAL",
      approverId: args.approver.effectiveApproverId,
      idempotencyKey,
      approvals: args.autoApprove
        ? {
            create: {
              approverId: args.actor.id,
              decision: "APPROVED",
              comment:
                args.input.requestType === "MIRROR"
                  ? "Auto-approved mirror request by role policy"
                  : "Auto-approved by role policy",
            },
          }
        : undefined,
      execution: args.autoApprove
        ? {
            create: {
              status: "RUNNING",
              idempotencyKey,
            },
          }
        : undefined,
    },
    select: { id: true, justification: true, idempotencyKey: true },
  });

  return created;
}

async function writeRequestAudit(args: {
  actor: User;
  input: RequestInput;
  requestId: string;
  permissionId: string;
  targetUserId: string;
  mirrorSourceId: string | undefined;
  accessDurationMonths: 1 | 3 | 6 | 12 | undefined;
  delegationId: string | null;
  delegatedFromApproverId: string | null;
}) {
  await writeAuditLog({
    actorId: args.actor.id,
    action: args.input.requestType === "MIRROR" ? "REQUEST_CREATED_MIRROR" : "REQUEST_CREATED",
    entityType: "AccessRequest",
    entityId: args.requestId,
    details: {
      permissionId: args.permissionId,
      targetUserId: args.targetUserId,
      mirrorFromUserId: args.mirrorSourceId,
      accessDurationMonths: args.accessDurationMonths ?? null,
      delegatedFromApproverId: args.delegatedFromApproverId,
      delegationId: args.delegationId,
    },
  });
}

async function createRequests(args: {
  actor: User;
  targetUser: User;
  autoApprove: boolean;
  input: RequestInput;
  permissionIds: string[];
  permissionMap: Map<string, PermissionWithApproverContext>;
  mirrorSource: User | null;
}) {
  const createdRequests: CreatedRequestItem[] = [];

  if (!args.autoApprove) {
    const missingApproverPermissionIds = getPermissionsMissingOwner(args.permissionIds, args.permissionMap);

    if (missingApproverPermissionIds.length > 0) {
      return {
        error: NextResponse.json(
          {
            error: "One or more requested permissions do not have an owner configured",
            permissionIds: missingApproverPermissionIds,
          },
          { status: 400 },
        ),
      };
    }
  }

  for (const permissionId of args.permissionIds) {
    const permission = args.permissionMap.get(permissionId);
    if (!permission) continue;
    const accessDurationMonths = resolveAccessDurationMonthsForPermission(args.input, permissionId);
    const approver = await resolveRequestApprover({
      actor: args.actor,
      autoApprove: args.autoApprove,
      permission,
    });
    if (!approver) continue;

    const created = await createAccessRequestRecord({
      actor: args.actor,
      targetUser: args.targetUser,
      autoApprove: args.autoApprove,
      input: args.input,
      permission,
      accessDurationMonths,
      approver,
    });

    createdRequests.push({ request: created, permission, accessDurationMonths });

    await writeRequestAudit({
      actor: args.actor,
      input: args.input,
      requestId: created.id,
      permissionId: permission.id,
      targetUserId: args.targetUser.id,
      mirrorSourceId: args.mirrorSource?.id,
      accessDurationMonths,
      delegationId: approver.delegationId,
      delegatedFromApproverId: approver.delegatedFromApproverId,
    });
  }

  return createdRequests;
}

async function dispatchForAutoApproved(
  createdRequests: CreatedRequestItem[],
  targetUser: User,
  actorEmail: string,
) {
  for (const item of createdRequests) {
    await dispatchN8nAndHandleFailures({
      requestId: item.request.id,
      targetEmail: targetUser.email,
      permissionName: item.permission.name,
      systemName: item.permission.system.name,
      justification: item.request.justification,
      accessDurationMonths: item.accessDurationMonths,
      idempotencyKey: item.request.idempotencyKey,
      actorEmail,
    });
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const system = searchParams.get("system");
    const where = buildRequestFilters(user, status, system);

    const data = await db.accessRequest.findMany({
      where,
      include: {
        requester: true,
        targetUser: true,
        approver: true,
        permission: { include: { system: true } },
        execution: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAuth();
    const payload = await request.json();
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data as RequestInput;
    const target = await resolveTargetUser(actor, input);
    if ("error" in target) return target.error;

    const permissionsToRequest = await collectPermissionIds(input, target.targetUser.id);
    if ("error" in permissionsToRequest) return permissionsToRequest.error;

    const permissionLookup = await loadPermissions(permissionsToRequest.uniquePermissionIds);
    if ("error" in permissionLookup) return permissionLookup.error;

    const createdRequests = await createRequests({
      actor,
      targetUser: target.targetUser,
      autoApprove: target.autoApprove,
      input,
      permissionIds: permissionsToRequest.uniquePermissionIds,
      permissionMap: permissionLookup.permissionMap,
      mirrorSource: permissionsToRequest.mirrorSource,
    });
    if ("error" in createdRequests) return createdRequests.error;

    if (target.autoApprove) {
      await dispatchForAutoApproved(createdRequests, target.targetUser, actor.email);
    }

    return NextResponse.json(
      {
        data: {
          requestType: input.requestType,
          createdCount: createdRequests.length,
          requestIds: createdRequests.map((item) => item.request.id),
          firstRequestId: createdRequests[0]?.request.id,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return authErrorResponse(error);
  }
}
