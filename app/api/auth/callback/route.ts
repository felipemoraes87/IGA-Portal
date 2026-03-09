import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applySessionCookie, createUserSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { decodeJwtPayload, exchangeCodeForToken, extractGroups, fetchUserInfo, hashState } from "@/lib/keycloak";
import { recomputeRoleByUserId } from "@/lib/scim-provisioning";
import { normalizeGroupName, parseScimGroups } from "@/lib/scim";
import { Prisma } from "@prisma/client";

const OIDC_STATE_COOKIE = "iga_oidc_state";

function statusIsActive(status?: string | null) {
  return ["ativo", "active"].includes((status || "").toLowerCase());
}

function isMissingTableError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2021";
}

async function provisionUser(email: string, name: string) {
  let orchestratorUser: Awaited<ReturnType<typeof db.orchestratorUser.findFirst>> = null;
  try {
    orchestratorUser = await db.orchestratorUser.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        isCurrent: { equals: "true", mode: "insensitive" },
      },
      orderBy: [{ updatedAt: "desc" }, { rowId: "desc" }],
    });
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }

  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    if (orchestratorUser?.id) {
      const byId = await db.user.findUnique({ where: { id: orchestratorUser.id } });
      if (byId) {
        user = await db.user.update({
          where: { id: byId.id },
          data: { email, name: name || byId.name },
        });
      } else {
        user = await db.user.create({
          data: {
            id: orchestratorUser.id,
            email,
            name: name || orchestratorUser.name || email.split("@")[0],
            active: statusIsActive(orchestratorUser.status),
          },
        });
      }
    } else {
      user = await db.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          role: "USER",
        },
      });
    }
  }

  return user;
}

function clearOidcStateCookie(response: NextResponse) {
  response.cookies.set({
    name: OIDC_STATE_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });
}

function appUrlBase(request: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function appRedirect(path: string, request: Request) {
  const base = appUrlBase(request);
  return new URL(path, `${base}/`);
}

async function syncGroupsFromTokenIfPresent(userId: string, tokenPayloads: Array<Record<string, unknown> | null>) {
  const allPayloadGroups = tokenPayloads.flatMap((payload) => extractGroups(payload));
  const hasGroupsClaim = tokenPayloads.some((payload) => Boolean(payload && Object.prototype.hasOwnProperty.call(payload, "groups")));
  if (!hasGroupsClaim) return;

  const normalized = parseScimGroups(
    allPayloadGroups.map((group) => ({
      value: normalizeGroupName(group),
      display: normalizeGroupName(group),
    })),
  );

  await db.$transaction(async (tx) => {
    await tx.userScimGroup.deleteMany({ where: { userId } });
    if (normalized.length) {
      await tx.userScimGroup.createMany({
        data: normalized.map((group) => ({
          userId,
          value: group.value,
          display: group.display ?? group.value,
        })),
        skipDuplicates: true,
      });
    }
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(appRedirect(`/login?error=${encodeURIComponent(error)}`, request));
  }
  if (!code || !state) {
    return NextResponse.redirect(appRedirect("/login?error=missing_code", request));
  }

  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const stateCookie = cookieHeader
      .split(";")
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith(`${OIDC_STATE_COOKIE}=`))
      ?.split("=")[1];

    if (!stateCookie || stateCookie !== hashState(state)) {
      return NextResponse.redirect(appRedirect("/login?error=invalid_state", request));
    }

    const token = await exchangeCodeForToken(code);
    const userInfo = await fetchUserInfo(token.access_token);
    const idTokenPayload = decodeJwtPayload(token.id_token);
    const accessTokenPayload = decodeJwtPayload(token.access_token);
    const email = userInfo.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.redirect(appRedirect("/login?error=missing_email", request));
    }

    const resolvedName =
      userInfo.name?.trim() ||
      userInfo.preferred_username?.trim() ||
      (email.includes("@") ? email.split("@")[0] : email);

    let user = await provisionUser(email, resolvedName);
    if (!user.active) {
      return NextResponse.redirect(appRedirect("/login?error=inactive_user", request));
    }

    await syncGroupsFromTokenIfPresent(user.id, [idTokenPayload, accessTokenPayload]);
    const resolvedRole = await recomputeRoleByUserId(user.id);
    if (user.role !== resolvedRole || user.name !== resolvedName) {
      user = await db.user.update({
        where: { id: user.id },
        data: { role: resolvedRole, name: resolvedName },
      });
    }

    const sessionToken = await createUserSession(user.id);
    const response = NextResponse.redirect(appRedirect("/", request));
    applySessionCookie(response, sessionToken);
    clearOidcStateCookie(response);

    await writeAuditLog({
      actorId: user.id,
      action: "LOGIN_SSO",
      entityType: "User",
      entityId: user.id,
      details: {
        provider: "keycloak",
        email: user.email,
        role: user.role,
      },
    });

    return response;
  } catch (callbackError) {
    console.error(callbackError);
    return NextResponse.redirect(appRedirect("/login?error=sso_callback_failed", request));
  }
}
