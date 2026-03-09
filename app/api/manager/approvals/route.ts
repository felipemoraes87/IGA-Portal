import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireRole("MANAGER");

    const data = await db.accessRequest.findMany({
      where:
        user.role === "ADMIN"
          ? { status: "PENDING_APPROVAL" }
          : { status: "PENDING_APPROVAL", approverId: user.id },
      include: {
        requester: true,
        targetUser: true,
        permission: { include: { system: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return authErrorResponse(error);
  }
}
