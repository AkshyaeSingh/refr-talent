import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  airtableConfigured,
  buildAuthorizeUrl,
  codeChallengeFromVerifier,
  generateCodeVerifier,
  generateState,
  getAirtableOAuthConfig,
  requestOrigin,
} from "@/lib/airtable/oauth";

// Starts the Airtable OAuth flow: stashes a CSRF state + PKCE verifier in
// short-lived cookies, then redirects the (logged-in) user to Airtable.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const base = requestOrigin(req);
  if (!user) return NextResponse.redirect(new URL("/login", base));
  if (!airtableConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/integrations?airtable=unconfigured", base));
  }

  const config = getAirtableOAuthConfig();
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const authorizeUrl = buildAuthorizeUrl(config, {
    state,
    codeChallenge: codeChallengeFromVerifier(codeVerifier),
  });

  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  };
  cookieStore.set(OAUTH_STATE_COOKIE, state, opts);
  cookieStore.set(OAUTH_VERIFIER_COOKIE, codeVerifier, opts);

  return NextResponse.redirect(authorizeUrl);
}
