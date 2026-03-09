import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { adminApprovalDelegationCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const data = await db.approvalDelegation.findMany({
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
    const actor = await requireRole("ADMIN");
    const parsed = adminApprovalDelegationCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = new Date(parsed.data.endsAt);
    const normalizedReason = parsed.data.reason?.trim() || null;

    const [delegator, delegate] = await Promise.all([
      db.user.findUnique({
        where: { id: parsed.data.delegatorId },
        select: { id: true, active: true },
      }),
      db.user.findUnique({
        where: { id: parsed.data.delegateId },
        select: { id: true, active: true },
      }),
    ]);

    if (!delegator?.active) {
      return NextResponse.json({ error: "Delegator not found or inactive" }, { status: 404 });
    }
    if (!delegate?.active) {
      return NextResponse.json({ error: "Delegate not found or inactive" }, { status: 404 });
    }

    let systemId = parsed.data.systemId || null;
    let permissionId = parsed.data.permissionId || null;

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
        delegateId: parsed.data.delegatorId,
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
        delegatorId: parsed.data.delegatorId,
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
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "APPROVAL_DELEGATION_CREATED",
      entityType: "ApprovalDelegation",
      entityId: created.id,
      details: {
        delegatorId: created.delegatorId,
        delegateId: created.delegateId,
        scope: created.scope,
        systemId: created.systemId,
        permissionId: created.permissionId,
        startsAt: created.startsAt,
        endsAt: created.endsAt,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
