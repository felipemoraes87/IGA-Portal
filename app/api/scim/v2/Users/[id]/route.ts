import { NextResponse } from "next/server";
import { requireScimBearerAuth } from "@/lib/scim-auth";
import { parseScimGroups, parseScimUserPayload, SCIM_PATCH_OP_SCHEMA } from "@/lib/scim";
import { findUserByScimId, softDeleteUserFromScim, upsertUserFromScim } from "@/lib/scim-provisioning";
import { scimUserResource } from "@/lib/scim-response";

type Params = Readonly<{ params: Promise<{ id: string }> }>;

const SCIM_ERROR_SCHEMA = ["urn:ietf:params:scim:api:messages:2.0:Error"];
type ScimErrorStatus = 400 | 404 | 500;
type PatchOperation = {
  op?: unknown;
  path?: unknown;
  value?: unknown;
};

function scimError(status: ScimErrorStatus, detail: string) {
  return NextResponse.json(
    { schemas: SCIM_ERROR_SCHEMA, status: String(status), detail },
    { status },
  );
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isValidPatchSchema(body: Record<string, unknown>) {
  const schemas = Array.isArray(body.schemas) ? body.schemas : [];
  return schemas.includes(SCIM_PATCH_OP_SCHEMA);
}

function buildInitialPatchData(existing: Awaited<ReturnType<typeof findUserByScimId>>) {
  if (!existing) return null;
  return {
    externalId: existing.externalId ?? existing.id,
    userName: existing.email,
    emails: [{ value: existing.email, primary: true, type: "work" }],
    displayName: existing.name,
    active: existing.active,
    groups: existing.scimGroups.map((group) => ({ value: group.value, display: group.display ?? group.value })),
  } satisfies Record<string, unknown>;
}

function applyGroupsOperation(patchData: Record<string, unknown>, operation: string, value: unknown) {
  if (operation === "replace") {
    patchData.groups = parseScimGroups(value);
    return;
  }
  if (operation === "add") {
    const incoming = parseScimGroups(value);
    const current = parseScimGroups(patchData.groups);
    patchData.groups = [...current, ...incoming];
    return;
  }
  if (operation !== "remove") return;

  if (typeof value === "string") {
    patchData.groups = parseScimGroups(patchData.groups).filter((group) => group.value !== value);
    return;
  }
  patchData.groups = [];
}

type PatchPathHandler = (patchData: Record<string, unknown>, operation: string, value: unknown) => void;

const PATCH_PATH_HANDLERS: Record<string, PatchPathHandler> = {
  active: (patchData, operation, value) => {
    if (operation === "replace" && typeof value === "boolean") patchData.active = value;
  },
  displayname: (patchData, _operation, value) => {
    if (typeof value === "string") patchData.displayName = value;
  },
  emails: (patchData, _operation, value) => {
    if (Array.isArray(value)) patchData.emails = value;
  },
  groups: (patchData, operation, value) => {
    applyGroupsOperation(patchData, operation, value);
  },
  externalid: (patchData, _operation, value) => {
    if (typeof value === "string") patchData.externalId = value;
  },
};

function applyPatchOperation(patchData: Record<string, unknown>, operationItem: PatchOperation) {
  const operation = typeof operationItem.op === "string" ? operationItem.op.toLowerCase() : "";
  const normalizedPath =
    typeof operationItem.path === "string" && operationItem.path.length > 0
      ? operationItem.path.toLowerCase()
      : "active";
  const value = operationItem.value;
  const handler = PATCH_PATH_HANDLERS[normalizedPath];
  if (!handler) return;
  handler(patchData, operation, value);
}

function resolveScimErrorStatus(message: string): ScimErrorStatus {
  return message.startsWith("SCIM_MISSING") || message === "SCIM_INVALID_BODY" ? 400 : 500;
}

export async function GET(request: Request, context: Params) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const user = await findUserByScimId(id);
  if (!user) {
    return scimError(404, "User not found");
  }

  return NextResponse.json(scimUserResource(user, request), {
    headers: { "Content-Type": "application/scim+json" },
  });
}

export async function PUT(request: Request, context: Params) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const existing = await findUserByScimId(id);
  if (!existing) {
    return scimError(404, "User not found");
  }

  const body = await parseJsonBody(request);
  if (!body) return scimError(400, "Invalid JSON");

  try {
    const parsed = parseScimUserPayload({
      ...body,
      externalId: body.externalId ?? existing.externalId ?? existing.id,
    });
    const { user } = await upsertUserFromScim({ payload: parsed, operation: "PUT", rawPayload: body as unknown });
    return NextResponse.json(scimUserResource(user, request), {
      headers: { "Content-Type": "application/scim+json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SCIM_ERROR";
    return scimError(resolveScimErrorStatus(message), message);
  }
}

export async function PATCH(request: Request, context: Params) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const existing = await findUserByScimId(id);
  if (!existing) {
    return scimError(404, "User not found");
  }

  const body = await parseJsonBody(request);
  if (!body) return scimError(400, "Invalid JSON");
  if (!isValidPatchSchema(body)) return scimError(400, "Invalid PATCH schema");

  const operations = Array.isArray(body.Operations) ? body.Operations : [];
  const patchData = buildInitialPatchData(existing);
  if (!patchData) return scimError(404, "User not found");

  for (const op of operations) {
    if (!op || typeof op !== "object") continue;
    applyPatchOperation(patchData, op as PatchOperation);
  }

  try {
    const parsed = parseScimUserPayload(patchData);
    const { user } = await upsertUserFromScim({ payload: parsed, operation: "PATCH", rawPayload: body });
    return NextResponse.json(scimUserResource(user, request), {
      headers: { "Content-Type": "application/scim+json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SCIM_ERROR";
    return scimError(resolveScimErrorStatus(message), message);
  }
}

export async function DELETE(request: Request, context: Params) {
  const authError = requireScimBearerAuth(request);
  if (authError) return authError;

  const { id } = await context.params;
  const user = await findUserByScimId(id);
  if (!user) {
    return scimError(404, "User not found");
  }

  await softDeleteUserFromScim(user, { id });
  return new NextResponse(null, { status: 204 });
}
