import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN");
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get("pageSize") || "20")));

    const where = {
      OR: [{ entityType: "ScimSettings" }],
      action: {
        in: ["SCIM_SETTINGS_UPDATED", "SCIM_TEST_CONNECTION", "SCIM_VALIDATE_SCHEMA"],
      },
    } as const;

    const [total, rows] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityId: row.entityId,
        actor: row.actor ? { id: row.actor.id, email: row.actor.email, name: row.actor.name } : null,
        createdAt: row.createdAt,
        details: row.details,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

