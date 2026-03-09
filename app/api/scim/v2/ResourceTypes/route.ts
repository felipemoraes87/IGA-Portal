import { NextResponse } from "next/server";
import { requireScimBearerAuth } from "@/lib/scim-auth";
import { SCIM_CORE_USER_SCHEMA, SCIM_LIST_RESPONSE_SCHEMA } from "@/lib/scim";

export async function GET(request: Request) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  const base = new URL(request.url).origin;
  return NextResponse.json(
    {
      schemas: [SCIM_LIST_RESPONSE_SCHEMA],
      totalResults: 1,
      startIndex: 1,
      itemsPerPage: 1,
      Resources: [
        {
          id: "User",
          name: "User",
          endpoint: "/Users",
          schema: SCIM_CORE_USER_SCHEMA,
          meta: {
            location: `${base}/api/scim/v2/ResourceTypes/User`,
            resourceType: "ResourceType",
          },
        },
      ],
    },
    { headers: { "Content-Type": "application/scim+json" } },
  );
}

