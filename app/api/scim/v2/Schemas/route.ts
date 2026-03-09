import { NextResponse } from "next/server";
import { requireScimBearerAuth } from "@/lib/scim-auth";
import { SCIM_CORE_USER_SCHEMA, SCIM_ENTERPRISE_USER_SCHEMA, SCIM_LIST_RESPONSE_SCHEMA, SCIM_PATCH_OP_SCHEMA } from "@/lib/scim";

export async function GET(request: Request) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  return NextResponse.json(
    {
      schemas: [SCIM_LIST_RESPONSE_SCHEMA],
      totalResults: 3,
      startIndex: 1,
      itemsPerPage: 3,
      Resources: [
        {
          id: SCIM_CORE_USER_SCHEMA,
          name: "User",
          description: "Core SCIM User schema",
        },
        {
          id: SCIM_ENTERPRISE_USER_SCHEMA,
          name: "EnterpriseUser",
          description: "Enterprise extension for manager relationship",
        },
        {
          id: SCIM_PATCH_OP_SCHEMA,
          name: "PatchOp",
          description: "SCIM PATCH operation schema",
        },
      ],
    },
    { headers: { "Content-Type": "application/scim+json" } },
  );
}
