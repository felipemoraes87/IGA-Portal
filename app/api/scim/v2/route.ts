import { NextResponse } from "next/server";
import { requireScimBearerAuth } from "@/lib/scim-auth";

export async function GET(request: Request) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  const origin = new URL(request.url).origin;
  return NextResponse.json(
    {
      resources: {
        serviceProviderConfig: `${origin}/api/scim/v2/ServiceProviderConfig`,
        resourceTypes: `${origin}/api/scim/v2/ResourceTypes`,
        schemas: `${origin}/api/scim/v2/Schemas`,
        users: `${origin}/api/scim/v2/Users`,
      },
    },
    { headers: { "Content-Type": "application/scim+json" } },
  );
}

