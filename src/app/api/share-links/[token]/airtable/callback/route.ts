import { NextResponse } from "next/server";
import { exchangeCodeForToken, getAirtableOAuthConfig, requestOrigin } from "@/lib/airtable/oauth";
import { clearQsOAuthCookies, readQsOAuthCookies, setQsToken } from "@/lib/airtable/quickShareSession";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = requestOrigin(req);
  const { searchParams } = new URL(req.url);

  const fail = (message: string) =>
    NextResponse.redirect(new URL(`/share/${token}?airtable=error&message=${encodeURIComponent(message)}`, base));

  const err = searchParams.get("error");
  if (err) return fail(searchParams.get("error_description") ?? err);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return fail("Missing code or state.");

  const { state: expectedState, verifier } = await readQsOAuthCookies();
  await clearQsOAuthCookies();
  if (!expectedState || !verifier) return fail("Session expired — try connecting again.");
  if (state !== expectedState) return fail("State mismatch — possible CSRF.");

  try {
    const config = getAirtableOAuthConfig();
    const tokenResp = await exchangeCodeForToken(config, { code, codeVerifier: verifier });
    await setQsToken(tokenResp.accessToken);
    return NextResponse.redirect(new URL(`/share/${token}?airtable=connected`, base));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Airtable connection failed.");
  }
}
