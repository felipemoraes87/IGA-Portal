import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireScimBearerAuth } from "@/lib/scim-auth";
import { parseScimUserPayload } from "@/lib/scim";
import { upsertUserFromScim } from "@/lib/scim-provisioning";
import { scimListResponse, scimUserResource } from "@/lib/scim-response";

function parseScimFilter(filter?: string | null) {
  if (!filter) return {};
  const normalized = filter.trim();
  const userNameMatch = normalized.match(/^userName\s+eq\s+"([^"]+)"$/i);
  if (userNameMatch) return { email: userNameMatch[1].toLowerCase() };
  const externalIdMatch = normalized.match(/^externalId\s+eq\s+"([^"]+)"$/i);
  if (externalIdMatch) return { externalId: externalIdMatch[1] };
  return {};
}

export async function GET(request: Request) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const startIndex = Math.max(1, Number(url.searchParams.get("startIndex") || "1"));
  const count = Math.min(200, Math.max(1, Number(url.searchParams.get("count") || "50")));
  const filter = parseScimFilter(url.searchParams.get("filter"));

  const where = {
    ...(filter.externalId ? { externalId: filter.externalId } : {}),
    ...(filter.email ? { email: filter.email } : {}),
  };

  const [totalResults, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      include: { scimGroups: true },
      orderBy: { createdAt: "asc" },
      skip: startIndex - 1,
      take: count,
    }),
  ]);

  const resources = users.map((user) => scimUserResource(user, request));
  return NextResponse.json(scimListResponse(resources, totalResults, startIndex, users.length), {
    headers: { "Content-Type": "application/scim+json" },
  });
}

export async function POST(request: Request) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        status: "400",
        detail: "Invalid JSON",
      },
      { status: 400 },
    );
  }

  try {
    const parsed = parseScimUserPayload(body);
    const { user, created } = await upsertUserFromScim({ payload: parsed, operation: "POST", rawPayload: body });
    return NextResponse.json(scimUserResource(user, request), {
      status: created ? 201 : 200,
      headers: { "Content-Type": "application/scim+json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SCIM_ERROR";
    const status = message.startsWith("SCIM_MISSING") || message === "SCIM_INVALID_BODY" ? 400 : 500;
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        status: String(status),
        detail: message,
      },
      { status },
    );
  }
}
