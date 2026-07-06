import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveAirtableConnection } from "@/lib/airtable/connection";
import {
  OAUTH_COOKIE_PATH,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  exchangeCodeForToken,
  getAirtableOAuthConfig,
  whoAmI,
} from "@/lib/airtable/oauth";

// Airtable redirects back here after the user authorizes: validate CSRF state
// + PKCE verifier, exchange the code for tokens, and store them (encrypted) on
// a Connector for the logged-in org.
export async function GET(req: Request) {
  const base = new URL(req.url).origin;
  const { searchParams } = new URL(req.url);

  const err = searchParams.get("error");
  if (err) return fail(base, searchParams.get("error_description") ?? err);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return fail(base, "Missing code or state.");

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", base));

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(OAUTH_VERIFIER_COOKIE)?.value;
  cookieStore.delete({ name: OAUTH_STATE_COOKIE, path: OAUTH_COOKIE_PATH });
  cookieStore.delete({ name: OAUTH_VERIFIER_COOKIE, path: OAUTH_COOKIE_PATH });

  if (!expectedState || !codeVerifier) return fail(base, "OAuth session expired — try again.");
  if (state !== expectedState) return fail(base, "State mismatch — possible CSRF.");

  try {
    const config = getAirtableOAuthConfig();
    const token = await exchangeCodeForToken(config, { code, codeVerifier });
    const { id: airtableUserId } = await whoAmI(token.accessToken);
    const connector = await saveAirtableConnection(user.orgId, airtableUserId, token);
    return NextResponse.redirect(
      new URL(`/dashboard/integrations?airtable=connected&connector=${connector.id}`, base)
    );
  } catch (e) {
    return fail(base, e instanceof Error ? e.message : "Airtable connection failed.");
  }
}

function fail(base: string, message: string) {
  const url = new URL("/dashboard/integrations", base);
  url.searchParams.set("airtable", "error");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url);
}
