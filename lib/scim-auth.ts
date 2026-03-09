import { NextResponse } from "next/server";

function getBearerToken(header?: string | null) {
  if (!header) return null;
  const [scheme, token] = header.trim().split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token;
}

export function getScimTokenConfig() {
  return process.env.SCIM_BEARER_TOKEN?.trim() || "";
}

export function requireScimBearerAuth(request: Request) {
  const expected = getScimTokenConfig();
  if (!expected) {
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        status: "500",
        detail: "SCIM bearer token is not configured",
      },
      { status: 500 },
    );
  }

  const incoming = getBearerToken(request.headers.get("authorization"));
  if (!incoming || incoming !== expected) {
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        status: "401",
        detail: "Unauthorized",
      },
      { status: 401, headers: { "WWW-Authenticate": "Bearer realm=\"scim\"" } },
    );
  }

  return null;
}

