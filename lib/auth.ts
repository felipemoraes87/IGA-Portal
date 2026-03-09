import { createHash, createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

const SESSION_COOKIE = "iga_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const roleHierarchy: Record<UserRole, number> = { USER: 1, MANAGER: 2, ADMIN: 3 };

function getSessionSecret() {
  return process.env.SESSION_SECRET || "local-dev-secret";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

function serializeSession(token: string) {
  return `${token}.${signToken(token)}`;
}

function parseSession(raw?: string) {
  if (!raw) return null;
  const [token, signature] = raw.split(".");
  if (!token || !signature) return null;
  const expected = signToken(token);
  if (signature !== expected) return null;
  return token;
}

export async function createUserSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({
    data: { userId, tokenHash, expiresAt },
  });
  return serializeSession(rawToken);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const token = parseSession(raw);
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.session.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
      user: { active: true },
    },
    include: {
      user: {
        include: {
          roleAssignments: {
            select: { role: true },
          },
        },
      },
    },
  });

  return session?.user ?? null;
}

export function getUserRoles(user: { role: UserRole; roleAssignments?: Array<{ role: UserRole }> }) {
  const assigned = user.roleAssignments?.map((item) => item.role) ?? [];
  if (!assigned.length) return [user.role];
  const dedup = new Set<UserRole>(assigned);
  dedup.add("USER");
  return Array.from(dedup.values());
}

export function hasMinimumRoleByUser(user: { role: UserRole; roleAssignments?: Array<{ role: UserRole }> }, minimumRole: UserRole) {
  const roles = getUserRoles(user);
  const highest = roles.reduce<UserRole>((best, current) => (roleHierarchy[current] > roleHierarchy[best] ? current : best), "USER");
  return roleHierarchy[highest] >= roleHierarchy[minimumRole];
}

export async function getAuthContext() {
  const user = await getCurrentUser();
  return {
    user,
    isAuthenticated: Boolean(user),
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireRole(minimumRole: UserRole) {
  const user = await requireAuth();
  if (!hasMinimumRoleByUser(user, minimumRole)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export function applySessionCookie(response: NextResponse, cookieValue: string) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionByCookie() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const token = parseSession(raw);
  if (!token) return;
  await db.session.deleteMany({
    where: {
      tokenHash: hashToken(token),
    },
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
  });
}

export function authErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
