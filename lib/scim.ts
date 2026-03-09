import { UserRole } from "@prisma/client";

export const SCIM_CORE_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_RESPONSE_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_PATCH_OP_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
export const SCIM_ENTERPRISE_USER_SCHEMA = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const SCIM_ADMIN_GROUP = "sr-security-cybersec-iam";

export type ParsedScimGroup = {
  value: string;
  display?: string;
};

export type ParsedScimUserPayload = {
  externalId: string;
  userName: string;
  email: string;
  displayName: string;
  active: boolean;
  managerExternalId?: string | null;
  groups?: ParsedScimGroup[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeEmail(candidate?: string): string | undefined {
  if (!candidate) return undefined;
  const normalized = candidate.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized;
}

export function parseScimGroups(input: unknown): ParsedScimGroup[] {
  if (!Array.isArray(input)) return [];
  const groups = input
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        return { value: item.trim() } as ParsedScimGroup;
      }
      if (isRecord(item)) {
        const value = asString(item.value);
        const display = asString(item.display);
        if (value) return { value, display };
      }
      return null;
    })
    .filter((item): item is ParsedScimGroup => Boolean(item));

  const dedup = new Map<string, ParsedScimGroup>();
  for (const group of groups) {
    dedup.set(group.value.toLowerCase(), group);
  }
  return Array.from(dedup.values());
}

export function normalizeGroupName(group: string) {
  const normalized = group.trim();
  return normalized.startsWith("/") ? normalized.slice(1) : normalized;
}

function parseEmailFromPayload(payload: Record<string, unknown>, userName?: string) {
  const emails = payload.emails;
  if (Array.isArray(emails)) {
    for (const item of emails) {
      if (isRecord(item)) {
        const value = normalizeEmail(asString(item.value));
        if (value) return value;
      }
    }
  }
  return normalizeEmail(userName);
}

function parseDisplayName(payload: Record<string, unknown>, email: string, userName: string) {
  const direct = asString(payload.displayName) || asString(payload.name);
  if (direct) return direct;

  const name = payload.name;
  if (isRecord(name)) {
    const given = asString(name.givenName) || "";
    const family = asString(name.familyName) || "";
    const joined = `${given} ${family}`.trim();
    if (joined) return joined;
  }

  if (email.includes("@")) return email.split("@")[0];
  return userName;
}

function parseManagerExternalId(payload: Record<string, unknown>) {
  const enterpriseExtension = payload[SCIM_ENTERPRISE_USER_SCHEMA];
  if (isRecord(enterpriseExtension) && isRecord(enterpriseExtension.manager)) {
    return asString(enterpriseExtension.manager.value) ?? null;
  }
  if (isRecord(payload.manager)) {
    return asString(payload.manager.value) ?? null;
  }
  return undefined;
}

export function parseScimUserPayload(body: unknown): ParsedScimUserPayload {
  if (!isRecord(body)) {
    throw new Error("SCIM_INVALID_BODY");
  }

  const externalId = asString(body.externalId);
  if (!externalId) {
    throw new Error("SCIM_MISSING_EXTERNAL_ID");
  }

  const userName = asString(body.userName) || (typeof body.userName === "number" ? String(body.userName) : undefined) || externalId;
  const email = parseEmailFromPayload(body, userName);
  if (!email) {
    throw new Error("SCIM_MISSING_EMAIL");
  }

  const displayName = parseDisplayName(body, email, userName);
  const active = typeof body.active === "boolean" ? body.active : true;
  const groups = Object.prototype.hasOwnProperty.call(body, "groups") ? parseScimGroups(body.groups) : undefined;
  const managerExternalId = parseManagerExternalId(body);

  return {
    externalId,
    userName,
    email,
    displayName,
    active,
    groups,
    managerExternalId,
  };
}

export function userHasAdminGroup(groups: Array<{ value: string }>) {
  return groups.some((group) => group.value.toLowerCase() === SCIM_ADMIN_GROUP.toLowerCase());
}

export function resolveRolesFromGroupsAndReports(groups: Array<{ value: string }>, hasDirectReports: boolean): UserRole[] {
  const roles = new Set<UserRole>(["USER"]);
  if (hasDirectReports) roles.add("MANAGER");
  if (userHasAdminGroup(groups)) roles.add("ADMIN");
  return Array.from(roles.values());
}

export function resolveEffectiveRole(roles: UserRole[]): UserRole {
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("MANAGER")) return "MANAGER";
  return "USER";
}

export function resolveRoleFromGroupsAndReports(groups: Array<{ value: string }>, hasDirectReports: boolean): UserRole {
  return resolveEffectiveRole(resolveRolesFromGroupsAndReports(groups, hasDirectReports));
}
