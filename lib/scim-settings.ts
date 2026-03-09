import { ScimAuthType, ScimEnvironment, ScimGroupSourceOfTruth, ScimProvisioningMode, ScimRetryBackoff, ScimSettings, ScimSyncStrategy, ScimUpdateMethod } from "@prisma/client";
import { z } from "zod";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/secret-crypto";

export const SCIM_ATTRIBUTE_SUGGESTIONS = [
  "userName",
  "name.givenName",
  "name.familyName",
  "displayName",
  "emails[work].value",
  "active",
  "externalId",
  "title",
];

export const DEFAULT_SCIM_ATTRIBUTE_MAPPINGS = [
  { scim_attribute: "userName", target_attribute: "email", required: true, transformation: "lowercase", default_value: "" },
  { scim_attribute: "displayName", target_attribute: "name", required: true, transformation: "none", default_value: "" },
  { scim_attribute: "externalId", target_attribute: "externalId", required: true, transformation: "none", default_value: "" },
  { scim_attribute: "active", target_attribute: "active", required: true, transformation: "none", default_value: "true" },
];

export const scimSettingsSchema = z.object({
  tenantKey: z.string().min(1).max(80).default("default"),
  environment: z.enum(["production", "staging", "sandbox"]).default("production"),
  scim_base_url: z.string().url(),
  auth_type: z.enum(["bearer_token", "oauth2", "api_key"]),
  bearer_token: z.string().optional(),
  oauth2: z
    .object({
      token_url: z.string().url(),
      client_id: z.string().min(1),
      client_secret: z.string().optional(),
      scopes: z.array(z.string().min(1)).default([]),
    })
    .optional(),
  api_key: z
    .object({
      api_key: z.string().optional(),
      api_key_header: z.string().min(1).default("Authorization"),
    })
    .optional(),
  token_expiration: z.number().int().positive().optional().nullable(),
  auto_rotate_token: z.boolean().default(false),
  enable_create_user: z.boolean().default(true),
  enable_update_user: z.boolean().default(true),
  update_method: z.enum(["PATCH", "PUT"]).default("PATCH"),
  enable_deactivate_user: z.boolean().default(true),
  enable_delete_user: z.boolean().default(false),
  provisioning_mode: z.enum(["real_time", "batch"]).default("real_time"),
  attribute_mappings: z
    .array(
      z.object({
        scim_attribute: z.string().min(1),
        target_attribute: z.string().min(1),
        required: z.boolean().default(false),
        transformation: z.enum(["none", "lowercase", "uppercase", "concat", "regex"]).default("none"),
        default_value: z.string().optional().nullable(),
      }),
    )
    .default(DEFAULT_SCIM_ATTRIBUTE_MAPPINGS),
  enable_group_sync: z.boolean().default(false),
  group_source_of_truth: z.enum(["scim", "local", "hybrid"]).default("scim"),
  group_mappings: z
    .array(
      z.object({
        scim_group: z.string().min(1),
        business_role: z.string().optional().nullable(),
        system_roles: z.array(z.string().min(1)).default([]),
      }),
    )
    .default([]),
  sync_group_membership: z.boolean().default(true),
  sync_strategy: z.enum(["full", "incremental"]).default("incremental"),
  sync_interval_minutes: z.number().int().positive().default(60),
  retry_enabled: z.boolean().default(true),
  max_retries: z.number().int().min(0).max(20).default(3),
  retry_backoff: z.enum(["fixed", "exponential"]).default("exponential"),
  ip_allowlist: z.array(z.string().min(1)).default([]),
  rate_limit_per_minute: z.number().int().positive().optional().nullable(),
  mtls_enabled: z.boolean().default(false),
  audit_enabled: z.boolean().default(true),
  retention_days: z.number().int().positive().default(90),
});

export type ScimSettingsInput = z.infer<typeof scimSettingsSchema>;

export function toDbEnums(input: ScimSettingsInput) {
  return {
    environment: input.environment as ScimEnvironment,
    authType: input.auth_type as ScimAuthType,
    updateMethod: input.update_method as ScimUpdateMethod,
    provisioningMode: input.provisioning_mode as ScimProvisioningMode,
    groupSourceOfTruth: input.group_source_of_truth as ScimGroupSourceOfTruth,
    syncStrategy: input.sync_strategy as ScimSyncStrategy,
    retryBackoff: input.retry_backoff as ScimRetryBackoff,
  };
}

export function toPublicSettings(row: ScimSettings) {
  return {
    id: row.id,
    tenantKey: row.tenantKey,
    environment: row.environment,
    scim_base_url: row.scimBaseUrl,
    connection_status: row.connectionStatus,
    auth_type: row.authType,
    bearer_token_masked: maskSecret(decryptSecret(row.bearerTokenEnc)),
    oauth2: {
      token_url: row.oauthTokenUrl || "",
      client_id: row.oauthClientId || "",
      client_secret_masked: maskSecret(decryptSecret(row.oauthClientSecretEnc)),
      scopes: Array.isArray(row.oauthScopes) ? row.oauthScopes : [],
    },
    api_key: {
      api_key_masked: maskSecret(decryptSecret(row.apiKeyEnc)),
      api_key_header: row.apiKeyHeader || "Authorization",
    },
    token_expiration: row.tokenExpiration,
    auto_rotate_token: row.autoRotateToken,
    enable_create_user: row.enableCreateUser,
    enable_update_user: row.enableUpdateUser,
    update_method: row.updateMethod,
    enable_deactivate_user: row.enableDeactivateUser,
    enable_delete_user: row.enableDeleteUser,
    provisioning_mode: row.provisioningMode,
    attribute_mappings: Array.isArray(row.attributeMappings) ? row.attributeMappings : DEFAULT_SCIM_ATTRIBUTE_MAPPINGS,
    enable_group_sync: row.enableGroupSync,
    group_source_of_truth: row.groupSourceOfTruth,
    group_mappings: Array.isArray(row.groupMappings) ? row.groupMappings : [],
    sync_group_membership: row.syncGroupMembership,
    sync_strategy: row.syncStrategy,
    sync_interval_minutes: row.syncIntervalMinutes,
    retry_enabled: row.retryEnabled,
    max_retries: row.maxRetries,
    retry_backoff: row.retryBackoff,
    ip_allowlist: Array.isArray(row.ipAllowlist) ? row.ipAllowlist : [],
    rate_limit_per_minute: row.rateLimitPerMinute,
    mtls_enabled: row.mtlsEnabled,
    audit_enabled: row.auditEnabled,
    retention_days: row.retentionDays,
    last_test: {
      at: row.lastTestAt,
      status: row.lastTestStatus || null,
      message: row.lastTestMessage || null,
    },
    last_schema_validation: {
      at: row.lastSchemaValidationAt,
      status: row.lastSchemaValidationStatus || null,
      message: row.lastSchemaValidationMessage || null,
    },
    warnings: {
      auto_rotate_token: "not implemented",
      mtls_enabled: row.mtlsEnabled ? "requires infra support" : null,
      enable_delete_user: row.enableDeleteUser ? "risky operation enabled" : null,
    },
  };
}

export function buildSecretUpdates(input: ScimSettingsInput, current?: ScimSettings | null) {
  const secretUpdates: Record<string, string | null> = {};

  if (input.auth_type === "bearer_token") {
    const value = input.bearer_token?.trim();
    if (value) secretUpdates.bearerTokenEnc = encryptSecret(value);
    else if (!current?.bearerTokenEnc) secretUpdates.bearerTokenEnc = null;
  }

  if (input.auth_type === "oauth2") {
    const clientSecret = input.oauth2?.client_secret?.trim();
    if (clientSecret) secretUpdates.oauthClientSecretEnc = encryptSecret(clientSecret);
    else if (!current?.oauthClientSecretEnc) secretUpdates.oauthClientSecretEnc = null;
  }

  if (input.auth_type === "api_key") {
    const key = input.api_key?.api_key?.trim();
    if (key) secretUpdates.apiKeyEnc = encryptSecret(key);
    else if (!current?.apiKeyEnc) secretUpdates.apiKeyEnc = null;
  }

  return secretUpdates;
}

export function getAuthHeadersForTest(settings: ScimSettings) {
  if (settings.authType === "bearer_token") {
    const token = decryptSecret(settings.bearerTokenEnc);
    if (!token) throw new Error("Bearer token is not configured");
    return { Authorization: `Bearer ${token}` };
  }
  if (settings.authType === "oauth2") {
    throw new Error("OAuth2 test is not implemented yet");
  }
  const apiKey = decryptSecret(settings.apiKeyEnc);
  if (!apiKey) throw new Error("API key is not configured");
  const header = settings.apiKeyHeader || "Authorization";
  return { [header]: apiKey } as Record<string, string>;
}

