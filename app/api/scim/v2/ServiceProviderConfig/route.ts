import { NextResponse } from "next/server";
import { requireScimBearerAuth } from "@/lib/scim-auth";

export async function GET(request: Request) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: true },
      etag: { supported: false },
      authenticationSchemes: [
        {
          name: "Bearer Token",
          description: "Authorization: Bearer <token>",
          type: "oauthbearertoken",
          primary: true,
        },
      ],
    },
    { headers: { "Content-Type": "application/scim+json" } },
  );
}

