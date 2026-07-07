import { NextResponse } from "next/server";
import { exchangeCodeForToken, getAirtableOAuthConfig, requestOrigin } from "@/lib/airtable/oauth";
import { clearQsOAuthCookies, readQsOAuthCookies, setQsToken, qsRedirectUri } from "@/lib/airtable/quickShareSession";

// FIXED callback path (see authorize/route.ts for why) — the share-link token
// travels in the `state` param, not the URL, so this one route serves every
// quick-share link.
export async function GET(req: Request) {
  const base = requestOrigin(req);
  const { searchParams } = new URL(req.url);

  const state = searchParams.get("state");
  const shareToken = state?.split(".")[0];

  function fail(message: string) {
    const target = shareToken ? `/share/${shareToken}` : "/";
    return NextResponse.redirect(new URL(`${target}?airtable=error&message=${encodeURIComponent(message)}`, base));
  }

  const err = searchParams.get("error");
  if (err) return fail(searchParams.get("error_description") ?? err);

  const code = searchParams.get("code");
  if (!code || !state || !shareToken) return fail("Missing code or state.");

  const { state: expectedState, verifier } = await readQsOAuthCookies();
  await clearQsOAuthCookies();
  if (!expectedState || !verifier) return fail("Session expired — try connecting again.");
  if (state !== expectedState) return fail("State mismatch — possible CSRF.");

  try {
    const config = { ...getAirtableOAuthConfig(), redirectUri: qsRedirectUri(base) };
    const tokenResp = await exchangeCodeForToken(config, { code, codeVerifier: verifier });
    await setQsToken(tokenResp.accessToken);
    return NextResponse.redirect(new URL(`/share/${shareToken}?airtable=connected`, base));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Airtable connection failed.");
  }
}
