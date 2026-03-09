import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { buildLogExportSecretUpdates, logExportSettingsSchema, normalizeDestination, toPublicLogExportSettings } from "@/lib/log-export-settings";

async function ensureSettings() {
  return db.logExportSettings.upsert({
    where: { tenantKey: "default" },
    update: {},
    create: {
      tenantKey: "default",
      destination: "SPLUNK_HEC",
      enabled: false,
      splunkSource: "iga-portal",
      splunkSourceType: "iga:audit",
      s3Prefix: "iga-portal/audit",
    },
  });
}

export async function GET() {
  try {
    await requireRole("ADMIN");
    const settings = await ensureSettings();
    return NextResponse.json({ data: toPublicLogExportSettings(settings) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const payload = await request.json();
    const parsed = logExportSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const current = await ensureSettings();
    const input = parsed.data;
    const secretUpdates = buildLogExportSecretUpdates(input, current);

    const updated = await db.logExportSettings.update({
      where: { id: current.id },
      data: {
        tenantKey: input.tenantKey,
        destination: normalizeDestination(input.destination),
        enabled: input.enabled,
        splunkEndpoint: input.splunk.endpoint || null,
        splunkIndex: input.splunk.index || null,
        splunkSource: input.splunk.source || null,
        splunkSourceType: input.splunk.sourceType || null,
        s3Region: input.s3.region || null,
        s3Bucket: input.s3.bucket || null,
        s3Prefix: input.s3.prefix || null,
        ...secretUpdates,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "LOG_EXPORT_SETTINGS_UPDATED",
      entityType: "LogExportSettings",
      entityId: updated.id,
      details: {
        tenantKey: updated.tenantKey,
        destination: updated.destination,
        enabled: updated.enabled,
      },
    });

    return NextResponse.json({ data: toPublicLogExportSettings(updated) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

