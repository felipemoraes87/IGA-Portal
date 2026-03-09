import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = Promise<{ id: string }>;

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await requireRole("USER");
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, active: true, name: true, email: true },
    });

    if (!user || !user.active) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = await db.userPermissionAssignment.findMany({
      where: {
        userId: id,
        source: "DIRECT",
      },
      include: {
        permission: {
          include: {
            system: true,
          },
        },
      },
      orderBy: [{ permission: { system: { name: "asc" } } }, { permission: { name: "asc" } }],
    });

    return NextResponse.json({
      data: data.map((item) => ({
        id: item.id,
        permissionId: item.permissionId,
        systemName: item.permission.system.name,
        permissionName: item.permission.name,
        source: item.source,
      })),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
