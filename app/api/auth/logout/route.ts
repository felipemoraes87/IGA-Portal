import { NextResponse } from "next/server";
import { clearSessionByCookie, clearSessionCookie } from "@/lib/auth";
import { getKeycloakConfig, getKeycloakUrls } from "@/lib/keycloak";

export async function POST() {
  try {
    await clearSessionByCookie();
    const config = getKeycloakConfig();
    const urls = getKeycloakUrls(config);
    const logoutUrl = `${urls.logout}?${new URLSearchParams({
      client_id: config.clientId,
      post_logout_redirect_uri: `${config.appUrl}/login`,
    }).toString()}`;
    const response = NextResponse.redirect(logoutUrl);
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
