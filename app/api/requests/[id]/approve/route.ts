import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvalSchema } from "@/lib/validation";
import { sendRequestToN8N } from "@/lib/n8n";
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
        targetUser: true,
        permission: { include: { system: true } },
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
        status: "RUNNING",
        approvals: {
          create: {
            approverId: user.id,
            decision: "APPROVED",
            comment: parsed.data.comment,
          },
        },
        execution: {
          upsert: {
            create: {
              status: "RUNNING",
              idempotencyKey: requestData.idempotencyKey,
            },
            update: {
              status: "RUNNING",
              errorMessage: null,
              finishedAt: null,
            },
          },
        },
      },
      include: {
        targetUser: true,
        permission: { include: { system: true } },
      },
    });

    try {
      await sendRequestToN8N({
        request_id: updated.id,
        target_user: updated.targetUser.email,
        permission: updated.permission.name,
        system: updated.permission.system.name,
        action: "GRANT_ACCESS",
        justification: updated.justification,
        idempotency_key: updated.idempotencyKey,
        actor: user.email,
      });
    } catch (error) {
      console.error(error);
      await db.accessRequest.update({
        where: { id: updated.id },
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

    await writeAuditLog({
      actorId: user.id,
      action: "REQUEST_APPROVED",
      entityType: "AccessRequest",
      entityId: updated.id,
      details: {
        comment: parsed.data.comment,
        delegationId: approvalAuthorization.delegationId,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error(error);
    return authErrorResponse(error);
  }
}
