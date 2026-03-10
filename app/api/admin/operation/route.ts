import { NextResponse } from "next/server";
import { AssignmentSource } from "@prisma/client";
import { z } from "zod";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";

const operationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("MANAGE_SR_FOR_USER"),
    operation: z.enum(["GRANT", "REVOKE"]),
    userId: z.string().min(1),
    permissionId: z.string().min(1),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("RECON_BR"),
    businessRoleId: z.string().min(1),
    note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("RECON_SR"),
    permissionId: z.string().min(1),
    note: z.string().max(500).optional(),
  }),
  z
    .object({
      action: z.literal("CREATE_APPROVAL_DELEGATION"),
      delegatorId: z.string().min(1),
      delegateId: z.string().min(1),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      reason: z.string().min(5).max(500),
    })
    .superRefine((data, ctx) => {
      if (data.delegatorId === data.delegateId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["delegateId"],
          message: "delegateId must be different from delegatorId",
        });
      }
      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);
      if (startsAt >= endsAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endsAt"],
          message: "endsAt must be greater than startsAt",
        });
      }
    }),
]);

type OperationInput = z.infer<typeof operationSchema>;
type ManageSrInput = Extract<OperationInput, { action: "MANAGE_SR_FOR_USER" }>;
type ReconBrInput = Extract<OperationInput, { action: "RECON_BR" }>;
type ReconSrInput = Extract<OperationInput, { action: "RECON_SR" }>;
type CreateApprovalDelegationInput = Extract<OperationInput, { action: "CREATE_APPROVAL_DELEGATION" }>;

function isCurrentFilter() {
  return { equals: "true", mode: "insensitive" as const };
}

function summarize(value: unknown) {
  return JSON.stringify(value);
}

function parseNote(note?: string) {
  return note ?? null;
}

async function handleManageSrForUser(actorId: string, input: ManageSrInput) {
  const [user, permission, srCurrent] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { id: true, active: true } }),
    db.permission.findUnique({ where: { id: input.permissionId }, select: { id: true, systemId: true } }),
    db.orchestratorSystemRole.findFirst({
      where: { id: input.permissionId, isCurrent: isCurrentFilter() },
      select: { id: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (input.operation === "GRANT" && !user.active) {
    return NextResponse.json({ error: "User not found or inactive" }, { status: 404 });
  }
  if (!permission) {
    return NextResponse.json({ error: "Permission not found" }, { status: 404 });
  }

  const activeSystem = await db.orchestratorSoftware.findFirst({
    where: { id: permission.systemId, isCurrent: isCurrentFilter() },
    select: { id: true },
  });
  if (!srCurrent || !activeSystem) {
    return NextResponse.json({ error: "Permission or system is not active in orchestrator" }, { status: 400 });
  }

  const exists = await db.userPermissionAssignment.findFirst({
    where: {
      userId: input.userId,
      permissionId: input.permissionId,
      source: AssignmentSource.DIRECT,
    },
    select: { id: true },
  });

  if (input.operation === "GRANT") {
    if (exists) {
      return NextResponse.json({ data: { action: input.action, message: "Assignment already exists" } });
    }

    const created = await db.userPermissionAssignment.create({
      data: {
        userId: input.userId,
        permissionId: input.permissionId,
        source: AssignmentSource.DIRECT,
      },
    });

    const details = {
      operation: input.operation,
      userId: input.userId,
      permissionId: input.permissionId,
      source: "DIRECT",
      note: parseNote(input.note),
    };
    await writeAuditLog({
      actorId,
      action: "ADMIN_OPERATION_GRANT_SR_TO_USER",
      entityType: "UserPermissionAssignment",
      entityId: created.id,
      details,
    });

    return NextResponse.json({
      data: {
        action: input.action,
        createdId: created.id,
        summary: summarize(details),
      },
    });
  }

  if (!exists) {
    return NextResponse.json({ data: { action: input.action, message: "No direct assignment found to revoke" } });
  }

  const deleted = await db.userPermissionAssignment.deleteMany({
    where: {
      userId: input.userId,
      permissionId: input.permissionId,
      source: AssignmentSource.DIRECT,
    },
  });

  const details = {
    operation: input.operation,
    userId: input.userId,
    permissionId: input.permissionId,
    source: "DIRECT",
    deletedAssignments: deleted.count,
    note: parseNote(input.note),
  };
  await writeAuditLog({
    actorId,
    action: "ADMIN_OPERATION_REVOKE_SR_FROM_USER",
    entityType: "UserPermissionAssignment",
    entityId: `${input.userId}:${input.permissionId}`,
    details,
  });

  return NextResponse.json({
    data: {
      action: input.action,
      summary: summarize(details),
    },
  });
}

async function handleReconBr(actorId: string, input: ReconBrInput) {
  const businessRoleId = input.businessRoleId;

  const [businessRole, brCurrent] = await Promise.all([
    db.businessRole.findUnique({ where: { id: businessRoleId }, select: { id: true } }),
    db.orchestratorBusinessRole.findFirst({
      where: { id: businessRoleId, isCurrent: isCurrentFilter() },
      select: { id: true },
    }),
  ]);

  if (!businessRole) {
    return NextResponse.json({ error: "Business role not found" }, { status: 404 });
  }
  if (!brCurrent) {
    return NextResponse.json({ error: "Business role is not active in orchestrator" }, { status: 400 });
  }

  const expectedRows = await db.orchestratorSnapshotBrUsersMatch.findMany({
    where: { brId: businessRoleId, userId: { not: null } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const expectedUserIdsRaw = expectedRows.map((row) => row.userId).filter((id): id is string => Boolean(id));

  const activeUsers = await db.user.findMany({
    where: { id: { in: expectedUserIdsRaw }, active: true },
    select: { id: true },
  });
  const expectedUserIds = new Set(activeUsers.map((user) => user.id));

  const currentLinks = await db.userBusinessRole.findMany({
    where: { businessRoleId },
    select: { id: true, userId: true },
  });
  const currentUserIds = new Set(currentLinks.map((link) => link.userId));

  const toCreate = [...expectedUserIds].filter((userId) => !currentUserIds.has(userId));
  const toDeleteIds = currentLinks.filter((link) => !expectedUserIds.has(link.userId)).map((link) => link.id);

  await db.$transaction(async (tx) => {
    if (toCreate.length > 0) {
      await tx.userBusinessRole.createMany({
        data: toCreate.map((userId) => ({
          userId,
          businessRoleId,
        })),
        skipDuplicates: true,
      });
    }
    if (toDeleteIds.length > 0) {
      await tx.userBusinessRole.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }
  });

  const details = {
    businessRoleId,
    createdLinks: toCreate.length,
    removedLinks: toDeleteIds.length,
    expectedUsers: expectedUserIds.size,
    note: parseNote(input.note),
  };
  await writeAuditLog({
    actorId,
    action: "ADMIN_OPERATION_RECON_BR",
    entityType: "BusinessRole",
    entityId: businessRoleId,
    details,
  });

  return NextResponse.json({
    data: {
      action: input.action,
      ...details,
      summary: summarize(details),
    },
  });
}

export function buildCurrentByUser(assignments: Array<{ id: string; userId: string }>) {
  const currentByUser = new Map<string, string[]>();
  for (const assignment of assignments) {
    const list = currentByUser.get(assignment.userId) ?? [];
    list.push(assignment.id);
    currentByUser.set(assignment.userId, list);
  }
  return currentByUser;
}

export function diffAssignments(expectedUserIds: Set<string>, currentByUser: Map<string, string[]>) {
  const toCreate: string[] = [];
  const toDeleteIds: string[] = [];

  for (const [userId, ids] of currentByUser.entries()) {
    if (!expectedUserIds.has(userId)) {
      toDeleteIds.push(...ids);
      continue;
    }
    if (ids.length > 1) {
      toDeleteIds.push(...ids.slice(1));
    }
  }

  for (const userId of expectedUserIds) {
    const existing = currentByUser.get(userId);
    if (!existing?.length) {
      toCreate.push(userId);
    }
  }

  return { toCreate, toDeleteIds };
}

async function handleReconSr(actorId: string, input: ReconSrInput) {
  const permission = await db.permission.findUnique({
    where: { id: input.permissionId },
    select: { id: true, systemId: true },
  });
  if (!permission) {
    return NextResponse.json({ error: "Permission not found" }, { status: 404 });
  }

  const [srCurrent, systemCurrent] = await Promise.all([
    db.orchestratorSystemRole.findFirst({
      where: { id: permission.id, isCurrent: isCurrentFilter() },
      select: { id: true },
    }),
    db.orchestratorSoftware.findFirst({
      where: { id: permission.systemId, isCurrent: isCurrentFilter() },
      select: { id: true },
    }),
  ]);
  if (!srCurrent || !systemCurrent) {
    return NextResponse.json({ error: "Permission or system is not active in orchestrator" }, { status: 400 });
  }

  const expectedLinks = await db.userBusinessRole.findMany({
    where: {
      user: { active: true },
      businessRole: {
        permissions: { some: { permissionId: permission.id } },
      },
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  const expectedUserIds = new Set(expectedLinks.map((item) => item.userId));

  const currentAssignments = await db.userPermissionAssignment.findMany({
    where: { permissionId: permission.id, source: AssignmentSource.BR },
    select: { id: true, userId: true },
    orderBy: { createdAt: "asc" },
  });

  const currentByUser = buildCurrentByUser(currentAssignments);
  const { toCreate, toDeleteIds } = diffAssignments(expectedUserIds, currentByUser);

  await db.$transaction(async (tx) => {
    if (toCreate.length > 0) {
      await tx.userPermissionAssignment.createMany({
        data: toCreate.map((userId) => ({
          userId,
          permissionId: permission.id,
          source: AssignmentSource.BR,
        })),
      });
    }
    if (toDeleteIds.length > 0) {
      await tx.userPermissionAssignment.deleteMany({
        where: { id: { in: toDeleteIds } },
      });
    }
  });

  const details = {
    permissionId: permission.id,
    createdAssignments: toCreate.length,
    removedAssignments: toDeleteIds.length,
    expectedUsers: expectedUserIds.size,
    note: parseNote(input.note),
  };
  await writeAuditLog({
    actorId,
    action: "ADMIN_OPERATION_RECON_SR",
    entityType: "Permission",
    entityId: permission.id,
    details,
  });

  return NextResponse.json({
    data: {
      action: input.action,
      ...details,
      summary: summarize(details),
    },
  });
}

async function handleCreateApprovalDelegation(actorId: string, input: CreateApprovalDelegationInput) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const reason = input.reason.trim();

  const [delegator, delegate] = await Promise.all([
    db.user.findUnique({
      where: { id: input.delegatorId },
      select: { id: true, active: true },
    }),
    db.user.findUnique({
      where: { id: input.delegateId },
      include: { roleAssignments: { select: { role: true } } },
    }),
  ]);

  if (!delegator) {
    return NextResponse.json({ error: "Delegator not found" }, { status: 404 });
  }
  if (!delegate?.active) {
    return NextResponse.json({ error: "Delegate not found or inactive" }, { status: 404 });
  }

  const delegateHasApprovalRole =
    delegate.role === "MANAGER" ||
    delegate.role === "ADMIN" ||
    delegate.roleAssignments.some((assignment) => assignment.role === "MANAGER" || assignment.role === "ADMIN");
  if (!delegateHasApprovalRole) {
    return NextResponse.json({ error: "Delegate must have manager approval role" }, { status: 400 });
  }

  const overlappingReverse = await db.approvalDelegation.findFirst({
    where: {
      active: true,
      delegatorId: input.delegateId,
      delegateId: input.delegatorId,
      startsAt: { lte: endsAt },
      endsAt: { gte: startsAt },
    },
    select: { id: true },
  });
  if (overlappingReverse) {
    return NextResponse.json({ error: "Conflicting reverse delegation already exists in the same period" }, { status: 409 });
  }

  const created = await db.approvalDelegation.create({
    data: {
      delegatorId: input.delegatorId,
      delegateId: input.delegateId,
      scope: "ANY",
      startsAt,
      endsAt,
      reason,
      active: true,
      createdById: actorId,
      updatedById: actorId,
    },
  });

  const details = {
    delegatorId: input.delegatorId,
    delegateId: input.delegateId,
    scope: "ANY",
    startsAt,
    endsAt,
    reason,
    delegatorActive: delegator.active,
    source: "ADMIN_OPERATION",
  };
  await writeAuditLog({
    actorId,
    action: "ADMIN_OPERATION_CREATE_APPROVAL_DELEGATION",
    entityType: "ApprovalDelegation",
    entityId: created.id,
    details,
  });

  return NextResponse.json({
    data: {
      action: input.action,
      createdId: created.id,
      summary: summarize(details),
    },
  });
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const parsed = operationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    switch (parsed.data.action) {
      case "MANAGE_SR_FOR_USER":
        return handleManageSrForUser(actor.id, parsed.data);
      case "RECON_BR":
        return handleReconBr(actor.id, parsed.data);
      case "RECON_SR":
        return handleReconSr(actor.id, parsed.data);
      case "CREATE_APPROVAL_DELEGATION":
        return handleCreateApprovalDelegation(actor.id, parsed.data);
      default:
        return NextResponse.json({ error: "Unsupported operation" }, { status: 400 });
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}
