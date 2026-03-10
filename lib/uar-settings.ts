import { UarSettings } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

export const uarSettingsSchema = z.object({
  tenantKey: z.string().trim().min(1).default("default"),
  systemReviewPeriodDays: z.coerce.number().int().min(30).max(1095),
  srReviewPeriodDays: z.coerce.number().int().min(30).max(1095),
  brReviewPeriodDays: z.coerce.number().int().min(30).max(1095),
  directAccessReviewPeriodDays: z.coerce.number().int().min(7).max(365),
  reviewLookbackDays: z.coerce.number().int().min(7).max(365),
  reviewWarningWindowDays: z.coerce.number().int().min(7).max(180),
  overdueGraceDays: z.coerce.number().int().min(0).max(90),
  notifyOwnersBeforeDays: z.coerce.number().int().min(1).max(90),
  autoRevokeOnOverdue: z.boolean().default(true),
  requireJustificationOnRenewal: z.boolean().default(true),
});

export type UarSettingsInput = z.infer<typeof uarSettingsSchema>;

export async function ensureUarSettings() {
  return db.uarSettings.upsert({
    where: { tenantKey: "default" },
    update: {},
    create: {
      tenantKey: "default",
      systemReviewPeriodDays: 365,
      srReviewPeriodDays: 180,
      brReviewPeriodDays: 180,
      directAccessReviewPeriodDays: 90,
      reviewLookbackDays: 30,
      reviewWarningWindowDays: 30,
      overdueGraceDays: 0,
      notifyOwnersBeforeDays: 15,
      autoRevokeOnOverdue: true,
      requireJustificationOnRenewal: true,
    },
  });
}

export function toPublicUarSettings(settings: UarSettings) {
  return {
    id: settings.id,
    tenantKey: settings.tenantKey,
    systemReviewPeriodDays: settings.systemReviewPeriodDays,
    srReviewPeriodDays: settings.srReviewPeriodDays,
    brReviewPeriodDays: settings.brReviewPeriodDays,
    directAccessReviewPeriodDays: settings.directAccessReviewPeriodDays,
    reviewLookbackDays: settings.reviewLookbackDays,
    reviewWarningWindowDays: settings.reviewWarningWindowDays,
    overdueGraceDays: settings.overdueGraceDays,
    notifyOwnersBeforeDays: settings.notifyOwnersBeforeDays,
    autoRevokeOnOverdue: settings.autoRevokeOnOverdue,
    requireJustificationOnRenewal: settings.requireJustificationOnRenewal,
    updatedAt: settings.updatedAt,
  };
}

export function toAuditUarSettings(settings: UarSettings) {
  return {
    tenantKey: settings.tenantKey,
    systemReviewPeriodDays: settings.systemReviewPeriodDays,
    srReviewPeriodDays: settings.srReviewPeriodDays,
    brReviewPeriodDays: settings.brReviewPeriodDays,
    directAccessReviewPeriodDays: settings.directAccessReviewPeriodDays,
    reviewLookbackDays: settings.reviewLookbackDays,
    reviewWarningWindowDays: settings.reviewWarningWindowDays,
    overdueGraceDays: settings.overdueGraceDays,
    notifyOwnersBeforeDays: settings.notifyOwnersBeforeDays,
    autoRevokeOnOverdue: settings.autoRevokeOnOverdue,
    requireJustificationOnRenewal: settings.requireJustificationOnRenewal,
  };
}

export function diffUarSettings(before: ReturnType<typeof toAuditUarSettings>, after: ReturnType<typeof toAuditUarSettings>) {
  const changedFields = Object.keys(after).filter((key) => before[key as keyof typeof before] !== after[key as keyof typeof after]);
  return {
    changedFields,
    hasChanges: changedFields.length > 0,
  };
}
