import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminBusinessRoleSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const data = await db.businessRole.findMany({
      include: {
        permissions: {
          include: {
            permission: {
              include: {
                system: true,
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

export async function POST(request: Request) {
  try {
    await requireRole("ADMIN");
    const parsed = adminBusinessRoleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = await db.businessRole.create({ data: parsed.data });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
