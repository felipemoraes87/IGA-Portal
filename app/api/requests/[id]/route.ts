import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const requestData = await db.accessRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        targetUser: true,
        approver: true,
        permission: { include: { system: true } },
        approvals: { include: { approver: true }, orderBy: { decidedAt: "desc" } },
        execution: true,
      },
    });

    if (!requestData) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const canView =
      user.role === "ADMIN" ||
      requestData.requesterId === user.id ||
      requestData.targetUserId === user.id ||
      requestData.approverId === user.id ||
      (user.role === "MANAGER" && requestData.targetUser.managerId === user.id);

    if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ data: requestData });
  } catch (error) {
    return authErrorResponse(error);
  }
}
