import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { selfApprovalDelegationPatchSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireRole("MANAGER");
    const { id } = await params;
    const parsed = selfApprovalDelegationPatchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await db.approvalDelegation.findUnique({
      where: { id },
      select: { id: true, delegatorId: true, startsAt: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Delegation not found" }, { status: 404 });
    }

    if (actor.role !== "ADMIN" && existing.delegatorId !== actor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nextEndsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : undefined;
    if (nextEndsAt && nextEndsAt <= existing.startsAt) {
      return NextResponse.json({ error: "endsAt must be greater than startsAt" }, { status: 400 });
    }

    const updated = await db.approvalDelegation.update({
      where: { id },
      data: {
        ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
        ...(nextEndsAt ? { endsAt: nextEndsAt } : {}),
        ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason?.trim() || null } : {}),
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
      action: "APPROVAL_DELEGATION_UPDATED",
      entityType: "ApprovalDelegation",
      entityId: updated.id,
      details: {
        source: "SELF_SERVICE_APPROVALS",
        active: updated.active,
        endsAt: updated.endsAt,
        reason: updated.reason,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return authErrorResponse(error);
  }
}
