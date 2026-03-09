import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { buildSecretUpdates, DEFAULT_SCIM_ATTRIBUTE_MAPPINGS, scimSettingsSchema, toDbEnums, toPublicSettings } from "@/lib/scim-settings";

function parseQuery(url: string) {
  const u = new URL(url);
  const tenantKey = (u.searchParams.get("tenant") || "default").trim() || "default";
  const environmentRaw = (u.searchParams.get("environment") || "production").trim();
  const environment = ["production", "staging", "sandbox"].includes(environmentRaw) ? environmentRaw : "production";
  return { tenantKey, environment: environment as "production" | "staging" | "sandbox" };
}

async function ensureSettings(tenantKey: string, environment: "production" | "staging" | "sandbox") {
  return db.scimSettings.upsert({
    where: {
      tenantKey_environment: {
        tenantKey,
        environment,
      },
    },
    update: {},
    create: {
      tenantKey,
      environment,
      scimBaseUrl: "http://localhost:3000/api/scim/v2",
      authType: "bearer_token",
      apiKeyHeader: "Authorization",
      attributeMappings: DEFAULT_SCIM_ATTRIBUTE_MAPPINGS,
      groupMappings: [],
      oauthScopes: [],
      ipAllowlist: [],
    },
  });
}

export async function GET(request: Request) {
  try {
    await requireRole("ADMIN");
    const { tenantKey, environment } = parseQuery(request.url);
    const settings = await ensureSettings(tenantKey, environment);
    return NextResponse.json({ data: toPublicSettings(settings) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const payload = await request.json();
    const parsed = scimSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const enums = toDbEnums(input);
    const current = await db.scimSettings.findUnique({
      where: {
        tenantKey_environment: {
          tenantKey: input.tenantKey,
          environment: enums.environment,
        },
      },
    });
    const secrets = buildSecretUpdates(input, current);

    const updated = await db.scimSettings.upsert({
      where: {
        tenantKey_environment: {
          tenantKey: input.tenantKey,
          environment: enums.environment,
        },
      },
      update: {
        scimBaseUrl: input.scim_base_url,
        authType: enums.authType,
        oauthTokenUrl: input.oauth2?.token_url || null,
        oauthClientId: input.oauth2?.client_id || null,
        oauthScopes: input.oauth2?.scopes || [],
        apiKeyHeader: input.api_key?.api_key_header || "Authorization",
        tokenExpiration: input.token_expiration ?? null,
        autoRotateToken: input.auto_rotate_token,
        enableCreateUser: input.enable_create_user,
        enableUpdateUser: input.enable_update_user,
        updateMethod: enums.updateMethod,
        enableDeactivateUser: input.enable_deactivate_user,
        enableDeleteUser: input.enable_delete_user,
        provisioningMode: enums.provisioningMode,
        attributeMappings: input.attribute_mappings,
        enableGroupSync: input.enable_group_sync,
        groupSourceOfTruth: enums.groupSourceOfTruth,
        groupMappings: input.group_mappings,
        syncGroupMembership: input.sync_group_membership,
        syncStrategy: enums.syncStrategy,
        syncIntervalMinutes: input.sync_interval_minutes,
        retryEnabled: input.retry_enabled,
        maxRetries: input.max_retries,
        retryBackoff: enums.retryBackoff,
        ipAllowlist: input.ip_allowlist,
        rateLimitPerMinute: input.rate_limit_per_minute ?? null,
        mtlsEnabled: input.mtls_enabled,
        auditEnabled: input.audit_enabled,
        retentionDays: input.retention_days,
        ...secrets,
      },
      create: {
        tenantKey: input.tenantKey,
        environment: enums.environment,
        scimBaseUrl: input.scim_base_url,
        authType: enums.authType,
        oauthTokenUrl: input.oauth2?.token_url || null,
        oauthClientId: input.oauth2?.client_id || null,
        oauthScopes: input.oauth2?.scopes || [],
        apiKeyHeader: input.api_key?.api_key_header || "Authorization",
        tokenExpiration: input.token_expiration ?? null,
        autoRotateToken: input.auto_rotate_token,
        enableCreateUser: input.enable_create_user,
        enableUpdateUser: input.enable_update_user,
        updateMethod: enums.updateMethod,
        enableDeactivateUser: input.enable_deactivate_user,
        enableDeleteUser: input.enable_delete_user,
        provisioningMode: enums.provisioningMode,
        attributeMappings: input.attribute_mappings,
        enableGroupSync: input.enable_group_sync,
        groupSourceOfTruth: enums.groupSourceOfTruth,
        groupMappings: input.group_mappings,
        syncGroupMembership: input.sync_group_membership,
        syncStrategy: enums.syncStrategy,
        syncIntervalMinutes: input.sync_interval_minutes,
        retryEnabled: input.retry_enabled,
        maxRetries: input.max_retries,
        retryBackoff: enums.retryBackoff,
        ipAllowlist: input.ip_allowlist,
        rateLimitPerMinute: input.rate_limit_per_minute ?? null,
        mtlsEnabled: input.mtls_enabled,
        auditEnabled: input.audit_enabled,
        retentionDays: input.retention_days,
        ...secrets,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "SCIM_SETTINGS_UPDATED",
      entityType: "ScimSettings",
      entityId: updated.id,
      details: {
        tenantKey: updated.tenantKey,
        environment: updated.environment,
        authType: updated.authType,
        scimBaseUrl: updated.scimBaseUrl,
        changedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ data: toPublicSettings(updated) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

