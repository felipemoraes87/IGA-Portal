import { NextResponse } from "next/server";
import { authErrorResponse, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getAuthHeadersForTest } from "@/lib/scim-settings";

function shortErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Unknown error";
  const msg = error.message || "Unknown error";
  return msg.length > 180 ? `${msg.slice(0, 180)}...` : msg;
}

async function runConnectionTest(settingsId: string, mode: "connection" | "schema") {
  const settings = await db.scimSettings.findUnique({ where: { id: settingsId } });
  if (!settings) throw new Error("Settings not found");
  const headers = getAuthHeadersForTest(settings);

  const base = settings.scimBaseUrl.replace(/\/$/, "");
  const endpoint = mode === "connection" ? `${base}/ServiceProviderConfig` : `${base}/Schemas`;
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      ...headers,
      "Content-Type": "application/scim+json",
    },
    cache: "no-store",
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${bodyText.slice(0, 120)}`);
  }

  let parsed: unknown = null;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    throw new Error("Response is not valid JSON");
  }

  if (mode === "schema") {
    const hasSchemas = typeof parsed === "object" && parsed !== null && Object.prototype.hasOwnProperty.call(parsed, "schemas");
    const hasResources = typeof parsed === "object" && parsed !== null && Object.prototype.hasOwnProperty.call(parsed, "Resources");
    if (!hasSchemas && !hasResources) {
      throw new Error("Schema validation failed");
    }
  }

  return { endpoint, status: response.status };
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole("ADMIN");
    const body = (await request.json()) as { settingsId?: string; mode?: "connection" | "schema" };
    if (!body.settingsId || !body.mode || !["connection", "schema"].includes(body.mode)) {
      return NextResponse.json({ error: "settingsId and mode are required" }, { status: 400 });
    }

    const mode = body.mode;
    const now = new Date();

    try {
      const result = await runConnectionTest(body.settingsId, mode);
      await db.scimSettings.update({
        where: { id: body.settingsId },
        data:
          mode === "connection"
            ? {
                connectionStatus: "connected",
                lastTestAt: now,
                lastTestStatus: "success",
                lastTestMessage: `OK (${result.status})`,
              }
            : {
                lastSchemaValidationAt: now,
                lastSchemaValidationStatus: "success",
                lastSchemaValidationMessage: `OK (${result.status})`,
              },
      });

      await writeAuditLog({
        actorId: actor.id,
        action: mode === "connection" ? "SCIM_TEST_CONNECTION" : "SCIM_VALIDATE_SCHEMA",
        entityType: "ScimSettings",
        entityId: body.settingsId,
        details: {
          status: "success",
          endpoint: result.endpoint,
          httpStatus: result.status,
          at: now.toISOString(),
        },
      });

      return NextResponse.json({ ok: true, data: result });
    } catch (innerError) {
      const summary = shortErrorMessage(innerError);
      await db.scimSettings.update({
        where: { id: body.settingsId },
        data:
          mode === "connection"
            ? {
                connectionStatus: "error",
                lastTestAt: now,
                lastTestStatus: "error",
                lastTestMessage: summary,
              }
            : {
                lastSchemaValidationAt: now,
                lastSchemaValidationStatus: "error",
                lastSchemaValidationMessage: summary,
              },
      });

      await writeAuditLog({
        actorId: actor.id,
        action: mode === "connection" ? "SCIM_TEST_CONNECTION" : "SCIM_VALIDATE_SCHEMA",
        entityType: "ScimSettings",
        entityId: body.settingsId,
        details: {
          status: "error",
          message: summary,
          at: now.toISOString(),
        },
      });

      return NextResponse.json({ ok: false, error: summary }, { status: 400 });
    }
  } catch (error) {
    return authErrorResponse(error);
  }
}

