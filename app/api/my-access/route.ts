import { NextResponse } from "next/server";
import { authErrorResponse, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireAuth();
    const data = await db.userPermissionAssignment.findMany({
      where: { userId: user.id },
      include: {
        permission: {
          include: { system: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data });
  } catch (error) {
    return authErrorResponse(error);
  }
}
