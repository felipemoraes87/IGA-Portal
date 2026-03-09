import { User, UserScimGroup } from "@prisma/client";
import { SCIM_CORE_USER_SCHEMA, SCIM_LIST_RESPONSE_SCHEMA } from "@/lib/scim";

type UserWithGroups = User & { scimGroups: UserScimGroup[] };

export function scimUserResource(user: UserWithGroups, request: Request) {
  const base = new URL(request.url);
  const location = `${base.origin}/api/scim/v2/Users/${encodeURIComponent(user.id)}`;

  return {
    schemas: [SCIM_CORE_USER_SCHEMA],
    id: user.id,
    externalId: user.externalId ?? user.id,
    userName: user.email,
    displayName: user.name,
    name: {
      formatted: user.name,
    },
    active: user.active,
    emails: [{ value: user.email, primary: true, type: "work" }],
    groups: user.scimGroups.map((group) => ({ value: group.value, display: group.display ?? group.value })),
    meta: {
      resourceType: "User",
      created: user.createdAt.toISOString(),
      lastModified: user.updatedAt.toISOString(),
      location,
    },
  };
}

export function scimListResponse(resources: unknown[], totalResults: number, startIndex: number, itemsPerPage: number) {
  return {
    schemas: [SCIM_LIST_RESPONSE_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage,
    Resources: resources,
  };
}

