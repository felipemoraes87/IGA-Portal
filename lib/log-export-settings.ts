import { LogExportDestination, LogExportSettings } from "@prisma/client";
import { z } from "zod";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/secret-crypto";

export const logExportSettingsSchema = z.object({
  tenantKey: z.string().trim().min(1).default("default"),
  destination: z.enum(["SPLUNK_HEC", "AWS_S3"]),
  enabled: z.boolean().default(false),
  splunk: z
    .object({
      endpoint: z.string().trim().optional(),
      token: z.string().trim().optional(),
      index: z.string().trim().optional(),
      source: z.string().trim().optional(),
      sourceType: z.string().trim().optional(),
    })
    .default({}),
  s3: z
    .object({
      region: z.string().trim().optional(),
      bucket: z.string().trim().optional(),
      prefix: z.string().trim().optional(),
      accessKeyId: z.string().trim().optional(),
      secretAccessKey: z.string().trim().optional(),
      sessionToken: z.string().trim().optional(),
    })
    .default({}),
});

export type LogExportInput = z.infer<typeof logExportSettingsSchema>;

export function toPublicLogExportSettings(row: LogExportSettings) {
  return {
    id: row.id,
    tenantKey: row.tenantKey,
    destination: row.destination,
    enabled: row.enabled,
    splunk: {
      endpoint: row.splunkEndpoint || "",
      tokenMasked: maskSecret(decryptSecret(row.splunkTokenEnc)),
      index: row.splunkIndex || "",
      source: row.splunkSource || "",
      sourceType: row.splunkSourceType || "",
    },
    s3: {
      region: row.s3Region || "",
      bucket: row.s3Bucket || "",
      prefix: row.s3Prefix || "",
      accessKeyIdMasked: maskSecret(decryptSecret(row.s3AccessKeyIdEnc)),
      secretAccessKeyMasked: maskSecret(decryptSecret(row.s3SecretAccessKeyEnc)),
      sessionTokenMasked: maskSecret(decryptSecret(row.s3SessionTokenEnc)),
    },
    lastExport: {
      at: row.lastExportAt,
      status: row.lastExportStatus,
      message: row.lastExportMessage,
    },
  };
}

export function buildLogExportSecretUpdates(input: LogExportInput, current?: LogExportSettings | null) {
  const updates: Record<string, string | null> = {};

  const splunkToken = input.splunk.token?.trim();
  if (splunkToken) {
    updates.splunkTokenEnc = encryptSecret(splunkToken);
  } else if (!current?.splunkTokenEnc) {
    updates.splunkTokenEnc = null;
  }

  const s3AccessKeyId = input.s3.accessKeyId?.trim();
  if (s3AccessKeyId) {
    updates.s3AccessKeyIdEnc = encryptSecret(s3AccessKeyId);
  } else if (!current?.s3AccessKeyIdEnc) {
    updates.s3AccessKeyIdEnc = null;
  }

  const s3SecretAccessKey = input.s3.secretAccessKey?.trim();
  if (s3SecretAccessKey) {
    updates.s3SecretAccessKeyEnc = encryptSecret(s3SecretAccessKey);
  } else if (!current?.s3SecretAccessKeyEnc) {
    updates.s3SecretAccessKeyEnc = null;
  }

  const s3SessionToken = input.s3.sessionToken?.trim();
  if (s3SessionToken) {
    updates.s3SessionTokenEnc = encryptSecret(s3SessionToken);
  } else if (!current?.s3SessionTokenEnc) {
    updates.s3SessionTokenEnc = null;
  }

  return updates;
}

export function getDecryptedLogExportSecrets(settings: LogExportSettings) {
  return {
    splunkToken: decryptSecret(settings.splunkTokenEnc),
    s3AccessKeyId: decryptSecret(settings.s3AccessKeyIdEnc),
    s3SecretAccessKey: decryptSecret(settings.s3SecretAccessKeyEnc),
    s3SessionToken: decryptSecret(settings.s3SessionTokenEnc),
  };
}

export function normalizeDestination(destination: string): LogExportDestination {
  return destination === "AWS_S3" ? "AWS_S3" : "SPLUNK_HEC";
}

