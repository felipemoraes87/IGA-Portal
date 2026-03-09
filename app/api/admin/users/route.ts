import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminUserSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const data = await db.user.findMany({
      include: {
        manager: true,
        reports: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN");
    const parsed = adminUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const roles: UserRole[] = Array.from(new Set<UserRole>(["USER", parsed.data.role as UserRole]));
    const data = await db.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        managerId: parsed.data.managerId || null,
        roleAssignments: {
          createMany: {
            data: roles.map((role) => ({ role })),
          },
        },
      },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
