import { NextResponse } from "next/server";
import { hasMinimumRoleByUser, requireRole, authErrorResponse } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { selfApprovalDelegationCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const actor = await requireRole("MANAGER");
    const data = await db.approvalDelegation.findMany({
      where: {
        OR: [{ delegatorId: actor.id }, { delegateId: actor.id }],
      },
      include: {
        delegator: {
          select: { id: true, name: true, email: true },
        },
        delegate: {
          select: { id: true, name: true, email: true },
        },
        system: {
          select: { id: true, name: true },
        },
        permission: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [{ active: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ data });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("MANAGER");
    const parsed = selfApprovalDelegationCreateSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.delegateId === actor.id) {
      return NextResponse.json({ error: "delegateId must be different from actor" }, { status: 400 });
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    const normalizedReason = parsed.data.reason?.trim() || null;

    const delegate = await db.user.findUnique({
      where: { id: parsed.data.delegateId },
      include: {
        roleAssignments: {
          select: { role: true },
        },
      },
    });

    if (!delegate?.active) {
      return NextResponse.json({ error: "Delegate not found or inactive" }, { status: 404 });
    }

    if (!hasMinimumRoleByUser(delegate, "MANAGER")) {
      return NextResponse.json({ error: "Delegate must have manager approval role" }, { status: 400 });
    }

    let systemId = parsed.data.systemId || null;
    const permissionId = parsed.data.permissionId || null;

    if (parsed.data.scope === "SYSTEM_OWNER" && !systemId) {
      return NextResponse.json({ error: "systemId is required for SYSTEM_OWNER scope" }, { status: 400 });
    }
    if (parsed.data.scope === "SR_OWNER" && !permissionId) {
      return NextResponse.json({ error: "permissionId is required for SR_OWNER scope" }, { status: 400 });
    }

    if (permissionId) {
      const permission = await db.permission.findUnique({
        where: { id: permissionId },
        select: { id: true, systemId: true },
      });
      if (!permission) {
        return NextResponse.json({ error: "Permission not found" }, { status: 404 });
      }
      if (systemId && systemId !== permission.systemId) {
        return NextResponse.json({ error: "Permission does not belong to informed systemId" }, { status: 400 });
      }
      systemId = permission.systemId;
    }

    if (systemId) {
      const system = await db.system.findUnique({
        where: { id: systemId },
        select: { id: true },
      });
      if (!system) {
        return NextResponse.json({ error: "System not found" }, { status: 404 });
      }
    }

    const overlappingReverse = await db.approvalDelegation.findFirst({
      where: {
        active: true,
        delegatorId: parsed.data.delegateId,
        delegateId: actor.id,
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
      },
      select: { id: true },
    });
    if (overlappingReverse) {
      return NextResponse.json({ error: "Conflicting reverse delegation already exists in the same period" }, { status: 409 });
    }

    const overlappingSameDirection = await db.approvalDelegation.findFirst({
      where: {
        active: true,
        delegatorId: actor.id,
        delegateId: parsed.data.delegateId,
        scope: parsed.data.scope,
        systemId,
        permissionId,
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
      },
      select: { id: true },
    });
    if (overlappingSameDirection) {
      return NextResponse.json({ error: "Overlapping delegation already exists for same scope and target" }, { status: 409 });
    }

    const created = await db.approvalDelegation.create({
      data: {
        delegatorId: actor.id,
        delegateId: parsed.data.delegateId,
        scope: parsed.data.scope,
        systemId,
        permissionId,
        startsAt,
        endsAt,
        reason: normalizedReason,
        active: true,
        createdById: actor.id,
        updatedById: actor.id,
      },
      include: {
        delegator: {
          select: { id: true, name: true, email: true },
        },
        delegate: {
          select: { id: true, name: true, email: true },
        },
        system: {
          select: { id: true, name: true },
        },
        permission: {
          select: { id: true, name: true },
        },
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "APPROVAL_DELEGATION_CREATED",
      entityType: "ApprovalDelegation",
      entityId: created.id,
      details: {
        source: "SELF_SERVICE_APPROVALS",
        delegatorId: created.delegatorId,
        delegateId: created.delegateId,
        scope: created.scope,
        systemId: created.systemId,
        permissionId: created.permissionId,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
        reason: created.reason,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
