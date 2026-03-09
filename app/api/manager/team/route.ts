import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await requireRole("MANAGER");
    const where = {
      active: true,
      managerId: user.id,
    };

    const data = await db.user.findMany({
      where,
      include: {
        permissionSnapshot: {
          where: {
            source: {
              not: "BR",
            },
          },
          include: {
            permission: { include: { system: true } },
          },
        },
        businessRoles: {
          include: {
            businessRole: {
              include: {
                permissions: {
                  include: {
                    permission: { include: { system: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data });
  } catch (error) {
    return authErrorResponse(error);
  }
}
