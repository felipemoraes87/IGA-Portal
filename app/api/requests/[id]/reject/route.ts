import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvalSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";
import { canActAsRequestApprover } from "@/lib/approval-delegation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireRole("MANAGER");
    const { id } = await params;
    const payload = await request.json().catch(() => ({}));
    const parsed = approvalSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const requestData = await db.accessRequest.findUnique({
      where: { id },
      include: {
        permission: {
          include: {
            system: {
              select: {
                ownerId: true,
              },
            },
          },
        },
      },
    });
    if (!requestData) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    if (requestData.status !== "PENDING_APPROVAL") {
      return NextResponse.json({ error: "Request is not pending approval" }, { status: 400 });
    }

    const approvalAuthorization =
      user.role === "ADMIN"
        ? { allowed: true as const, delegationId: null as string | null }
        : await canActAsRequestApprover(user.id, {
            approverId: requestData.approverId,
            permissionId: requestData.permissionId,
            permission: {
              ownerId: requestData.permission.ownerId,
              systemId: requestData.permission.systemId,
              system: {
                ownerId: requestData.permission.system.ownerId,
              },
            },
          });

    if (!approvalAuthorization.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await db.accessRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvals: {
          create: {
            approverId: user.id,
            decision: "REJECTED",
            comment: parsed.data.comment,
          },
        },
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "REQUEST_REJECTED",
      entityType: "AccessRequest",
      entityId: updated.id,
      details: {
        comment: parsed.data.comment,
        delegationId: approvalAuthorization.delegationId,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return authErrorResponse(error);
  }
}
