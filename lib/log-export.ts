import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AuditLog, LogExportSettings } from "@prisma/client";
import { getDecryptedLogExportSecrets } from "@/lib/log-export-settings";

type AuditLogWithActor = AuditLog & {
  actor: { id: string; name: string; email: string } | null;
};

function sanitizePrefix(prefix?: string | null) {
  const raw = (prefix || "").trim().replace(/^\/+|\/+$/g, "");
  return raw ? `${raw}/` : "";
}

function toNdjson(logs: AuditLogWithActor[]) {
  return logs
    .map((log) =>
      JSON.stringify({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor,
        createdAt: log.createdAt.toISOString(),
        details: log.details,
      }),
    )
    .join("\n");
}

async function exportToSplunkHEC(settings: LogExportSettings, logs: AuditLogWithActor[]) {
  const endpoint = settings.splunkEndpoint?.trim();
  const { splunkToken } = getDecryptedLogExportSecrets(settings);
  if (!endpoint) throw new Error("Splunk endpoint nao configurado.");
  if (!splunkToken) throw new Error("Splunk token nao configurado.");

  const hecEndpoint = endpoint.endsWith("/") ? `${endpoint}services/collector/event` : `${endpoint}/services/collector/event`;
  const index = settings.splunkIndex?.trim() || undefined;
  const source = settings.splunkSource?.trim() || "iga-portal";
  const sourcetype = settings.splunkSourceType?.trim() || "iga:audit";

  for (const log of logs) {
    const payload = {
      time: Math.floor(log.createdAt.getTime() / 1000),
      host: "iga-portal",
      source,
      sourcetype,
      ...(index ? { index } : {}),
      event: {
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor,
        createdAt: log.createdAt.toISOString(),
        details: log.details,
      },
    };

    const response = await fetch(hecEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Splunk ${splunkToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Splunk HEC retornou HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
  }

  return {
    destination: "SPLUNK_HEC",
    records: logs.length,
  };
}

async function exportToS3(settings: LogExportSettings, logs: AuditLogWithActor[]) {
  const region = settings.s3Region?.trim();
  const bucket = settings.s3Bucket?.trim();
  if (!region) throw new Error("S3 region nao configurada.");
  if (!bucket) throw new Error("S3 bucket nao configurado.");

  const { s3AccessKeyId, s3SecretAccessKey, s3SessionToken } = getDecryptedLogExportSecrets(settings);
  const client = new S3Client({
    region,
    credentials:
      s3AccessKeyId && s3SecretAccessKey
        ? {
            accessKeyId: s3AccessKeyId,
            secretAccessKey: s3SecretAccessKey,
            ...(s3SessionToken ? { sessionToken: s3SessionToken } : {}),
          }
        : undefined,
  });

  const prefix = sanitizePrefix(settings.s3Prefix);
  const now = new Date();
  const key = `${prefix}audit-logs-${now.toISOString().replace(/[:.]/g, "-")}.ndjson`;
  const body = toNdjson(logs);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "application/x-ndjson",
    }),
  );

  return {
    destination: "AWS_S3",
    records: logs.length,
    objectKey: key,
    bucket,
  };
}

export async function exportAuditLogs(settings: LogExportSettings, logs: AuditLogWithActor[]) {
  if (settings.destination === "SPLUNK_HEC") {
    return exportToSplunkHEC(settings, logs);
  }
  if (settings.destination === "AWS_S3") {
    return exportToS3(settings, logs);
  }
  throw new Error("Destino de exportacao nao suportado.");
}

