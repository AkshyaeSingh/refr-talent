import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  airtableConfigured,
  buildAuthorizeUrl,
  codeChallengeFromVerifier,
  generateCodeVerifier,
  generateState,
  getAirtableOAuthConfig,
  requestOrigin,
} from "@/lib/airtable/oauth";
import { setQsOAuthCookies } from "@/lib/airtable/quickShareSession";

// Starts the Airtable OAuth flow for an anonymous quick-share giver (no Refr
// account needed). State/verifier live in short-lived cookies scoped to this
// share link, same PKCE mechanism as the logged-in org flow.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = requestOrigin(req);

  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link || link.status === "CLOSED") {
    return NextResponse.redirect(new URL(`/share/${token}?airtable=error&message=Link+not+found`, base));
  }
  if (!airtableConfigured()) {
    return NextResponse.redirect(new URL(`/share/${token}?airtable=unconfigured`, base));
  }

  const config = getAirtableOAuthConfig();
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const authorizeUrl = buildAuthorizeUrl(config, { state, codeChallenge: codeChallengeFromVerifier(codeVerifier) });

  await setQsOAuthCookies(state, codeVerifier);
  return NextResponse.redirect(authorizeUrl);
}
