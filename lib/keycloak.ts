import { createHash, randomBytes } from "crypto";

type KeycloakConfig = {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  appUrl: string;
};

export type KeycloakUserInfo = {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
};

export function getKeycloakConfig(): KeycloakConfig {
  return {
    baseUrl: process.env.KEYCLOAK_BASE_URL || "http://localhost:8080",
    realm: process.env.KEYCLOAK_REALM || "iga",
    clientId: process.env.KEYCLOAK_CLIENT_ID || "iga-portal",
    clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "iga-portal-secret",
    appUrl: process.env.APP_URL || "http://localhost:3000",
  };
}

export function getKeycloakUrls(config = getKeycloakConfig()) {
  const realmBase = `${config.baseUrl}/realms/${config.realm}/protocol/openid-connect`;
  return {
    auth: `${realmBase}/auth`,
    token: `${realmBase}/token`,
    userInfo: `${realmBase}/userinfo`,
    logout: `${realmBase}/logout`,
  };
}

export function getCallbackUrl(config = getKeycloakConfig()) {
  return `${config.appUrl}/api/auth/callback`;
}

export function generateOidcState() {
  return randomBytes(24).toString("hex");
}

export function hashState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function buildAuthUrl(state: string, config = getKeycloakConfig()) {
  const urls = getKeycloakUrls(config);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getCallbackUrl(config),
    response_type: "code",
    scope: "openid profile email",
    state,
  });
  return `${urls.auth}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string, config = getKeycloakConfig()) {
  const urls = getKeycloakUrls(config);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: getCallbackUrl(config),
  });

  const response = await fetch(urls.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KEYCLOAK_TOKEN_ERROR:${response.status}:${text}`);
  }

  return (await response.json()) as {
    access_token: string;
    id_token?: string;
  };
}

export async function fetchUserInfo(accessToken: string, config = getKeycloakConfig()) {
  const urls = getKeycloakUrls(config);
  const response = await fetch(urls.userInfo, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`KEYCLOAK_USERINFO_ERROR:${response.status}:${text}`);
  }

  return (await response.json()) as KeycloakUserInfo;
}

export function decodeJwtPayload(token?: string): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractRealmRoles(payload: Record<string, unknown> | null) {
  if (!payload) return [] as string[];
  const realmAccess = payload["realm_access"];
  if (!realmAccess || typeof realmAccess !== "object") return [] as string[];
  const roles = (realmAccess as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) return [] as string[];
  return roles.filter((role): role is string => typeof role === "string");
}

export function extractGroups(payload: Record<string, unknown> | null) {
  if (!payload) return [] as string[];
  const groups = payload["groups"];
  if (!Array.isArray(groups)) return [] as string[];
  return groups.filter((group): group is string => typeof group === "string");
}
