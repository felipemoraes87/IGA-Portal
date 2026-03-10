import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { diffUarSettings, ensureUarSettings, toAuditUarSettings, toPublicUarSettings, uarSettingsSchema } from "@/lib/uar-settings";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await requireRole("ADMIN");
    const settings = await ensureUarSettings();
    return NextResponse.json({ data: toPublicUarSettings(settings) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const payload = await request.json();
    const parsed = uarSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const current = await ensureUarSettings();
    const beforeState = toAuditUarSettings(current);
    const input = parsed.data;
    const updated = await db.uarSettings.update({
      where: { id: current.id },
      data: {
        tenantKey: input.tenantKey,
        systemReviewPeriodDays: input.systemReviewPeriodDays,
        srReviewPeriodDays: input.srReviewPeriodDays,
        brReviewPeriodDays: input.brReviewPeriodDays,
        directAccessReviewPeriodDays: input.directAccessReviewPeriodDays,
        reviewLookbackDays: input.reviewLookbackDays,
        reviewWarningWindowDays: input.reviewWarningWindowDays,
        overdueGraceDays: input.overdueGraceDays,
        notifyOwnersBeforeDays: input.notifyOwnersBeforeDays,
        autoRevokeOnOverdue: input.autoRevokeOnOverdue,
        requireJustificationOnRenewal: input.requireJustificationOnRenewal,
      },
    });
    const afterState = toAuditUarSettings(updated);
    const diff = diffUarSettings(beforeState, afterState);

    await writeAuditLog({
      actorId: actor.id,
      action: "UAR_SETTINGS_UPDATED",
      entityType: "UarSettings",
      entityId: updated.id,
      details: {
        tenantKey: updated.tenantKey,
        changedFields: diff.changedFields,
        before: beforeState,
        after: afterState,
        changedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ data: toPublicUarSettings(updated) });
  } catch (error) {
    return authErrorResponse(error);
  }
}
