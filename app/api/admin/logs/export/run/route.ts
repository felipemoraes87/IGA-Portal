import { NextResponse } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { exportAuditLogs } from "@/lib/log-export";

const runExportSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

function shortError(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  const text = error.message || "Unknown error";
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const parsed = runExportSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    if (from >= to) {
      return NextResponse.json({ error: "`from` must be before `to`" }, { status: 400 });
    }

    const settings = await db.logExportSettings.findUnique({ where: { tenantKey: "default" } });
    if (!settings) {
      return NextResponse.json({ error: "Log export settings not configured" }, { status: 404 });
    }
    if (!settings.enabled) {
      return NextResponse.json({ error: "Log export is disabled" }, { status: 400 });
    }

    const logs = await db.auditLog.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 10000,
    });

    const now = new Date();
    try {
      const result = await exportAuditLogs(settings, logs);
      await db.logExportSettings.update({
        where: { id: settings.id },
        data: {
          lastExportAt: now,
          lastExportStatus: "success",
          lastExportMessage: `Exported ${logs.length} logs to ${result.destination}`,
        },
      });

      await writeAuditLog({
        actorId: actor.id,
        action: "LOG_EXPORT_EXECUTED",
        entityType: "LogExportSettings",
        entityId: settings.id,
        details: {
          from: from.toISOString(),
          to: to.toISOString(),
          exportedRecords: logs.length,
          destination: result.destination,
          result,
          status: "success",
        },
      });

      return NextResponse.json({
        ok: true,
        data: {
          from: from.toISOString(),
          to: to.toISOString(),
          exportedRecords: logs.length,
          destination: result.destination,
          result,
        },
      });
    } catch (innerError) {
      const message = shortError(innerError);
      await db.logExportSettings.update({
        where: { id: settings.id },
        data: {
          lastExportAt: now,
          lastExportStatus: "error",
          lastExportMessage: message,
        },
      });

      await writeAuditLog({
        actorId: actor.id,
        action: "LOG_EXPORT_EXECUTED",
        entityType: "LogExportSettings",
        entityId: settings.id,
        details: {
          from: from.toISOString(),
          to: to.toISOString(),
          exportedRecords: logs.length,
          destination: settings.destination,
          status: "error",
          error: message,
        },
      });

      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}

