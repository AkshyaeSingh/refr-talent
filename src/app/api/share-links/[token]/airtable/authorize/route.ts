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
import { setQsOAuthCookies, qsRedirectUri } from "@/lib/airtable/quickShareSession";

// Starts the Airtable OAuth flow for an anonymous quick-share giver (no Refr
// account needed). Uses a FIXED callback URL (qsRedirectUri) distinct from the
// logged-in org flow's — Airtable requires an exact pre-registered redirect_uri
// per client, it can't vary per share-link token — and carries the share-link
// token through the `state` param so the fixed callback knows where to return.
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

  const config = { ...getAirtableOAuthConfig(), redirectUri: qsRedirectUri(base) };
  const randomState = generateState();
  const state = `${token}.${randomState}`;
  const codeVerifier = generateCodeVerifier();
  const authorizeUrl = buildAuthorizeUrl(config, { state, codeChallenge: codeChallengeFromVerifier(codeVerifier) });

  await setQsOAuthCookies(state, codeVerifier);
  return NextResponse.redirect(authorizeUrl);
}
