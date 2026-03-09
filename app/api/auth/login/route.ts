import { NextResponse } from "next/server";
import { hashState, buildAuthUrl, generateOidcState } from "@/lib/keycloak";

const OIDC_STATE_COOKIE = "iga_oidc_state";
const OIDC_STATE_TTL_SECONDS = 60 * 10;

function applyOidcStateCookie(response: NextResponse, state: string) {
  response.cookies.set({
    name: OIDC_STATE_COOKIE,
    value: hashState(state),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_STATE_TTL_SECONDS,
  });
}

export async function GET() {
  const state = generateOidcState();
  const authUrl = buildAuthUrl(state);
  const response = NextResponse.redirect(authUrl);
  applyOidcStateCookie(response, state);
  return response;
}

export async function POST() {
  return GET();
}
