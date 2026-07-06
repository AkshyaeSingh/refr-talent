import crypto from "node:crypto";

// Low-level Airtable OAuth 2.0 helpers: configuration, PKCE, and the raw token
// endpoints. No database access here — persistence lives in connection.ts.
// Reference: https://airtable.com/developers/web/api/oauth-reference

export const AIRTABLE_AUTHORIZE_URL = "https://airtable.com/oauth2/v1/authorize";
export const AIRTABLE_TOKEN_URL = "https://airtable.com/oauth2/v1/token";
export const AIRTABLE_WHOAMI_URL = "https://api.airtable.com/v0/meta/whoami";

// Short-lived cookies carrying the CSRF state + PKCE verifier across the
// authorize -> callback redirect. Scoped to the OAuth route subtree.
export const OAUTH_STATE_COOKIE = "airtable_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "airtable_oauth_verifier";
export const OAUTH_COOKIE_PATH = "/api/oauth/airtable";

export interface AirtableOAuthConfig {
  clientId: string;
  clientSecret?: string; // when present, token endpoint uses HTTP Basic auth
  redirectUri: string;
  scopes: string;
}

export function airtableConfigured(): boolean {
  return Boolean(process.env.AIRTABLE_CLIENT_ID && process.env.AIRTABLE_REDIRECT_URI);
}

export function getAirtableOAuthConfig(): AirtableOAuthConfig {
  const clientId = process.env.AIRTABLE_CLIENT_ID;
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI;
  const scopes =
    process.env.AIRTABLE_SCOPES?.trim() || "data.records:read schema.bases:read";
  if (!clientId) throw new Error("AIRTABLE_CLIENT_ID is not set.");
  if (!redirectUri) throw new Error("AIRTABLE_REDIRECT_URI is not set.");
  return { clientId, clientSecret: process.env.AIRTABLE_CLIENT_SECRET || undefined, redirectUri, scopes };
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export const generateState = () => b64url(crypto.randomBytes(16));
export const generateCodeVerifier = () => b64url(crypto.randomBytes(32));
export const codeChallengeFromVerifier = (verifier: string) =>
  b64url(crypto.createHash("sha256").update(verifier).digest());

export function buildAuthorizeUrl(
  config: AirtableOAuthConfig,
  params: { state: string; codeChallenge: string }
): string {
  const url = new URL(AIRTABLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface AirtableTokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope?: string;
  expires_in: number;
  refresh_expires_in?: number;
}

async function requestToken(config: AirtableOAuthConfig, body: URLSearchParams): Promise<AirtableTokenResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (config.clientSecret) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  } else {
    body.set("client_id", config.clientId);
  }

  const res = await fetch(AIRTABLE_TOKEN_URL, { method: "POST", headers, body, cache: "no-store" });
  const text = await res.text();
  if (!res.ok) throw new Error(`Airtable token request failed (${res.status}): ${text || res.statusText}`);

  const raw = JSON.parse(text) as RawTokenResponse;
  const now = Date.now();
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    accessTokenExpiresAt: new Date(now + raw.expires_in * 1000),
    refreshTokenExpiresAt: raw.refresh_expires_in ? new Date(now + raw.refresh_expires_in * 1000) : null,
    scope: raw.scope ?? null,
  };
}

export function exchangeCodeForToken(
  config: AirtableOAuthConfig,
  params: { code: string; codeVerifier: string }
): Promise<AirtableTokenResponse> {
  return requestToken(
    config,
    new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: config.redirectUri,
      code_verifier: params.codeVerifier,
    })
  );
}

export function refreshAccessToken(config: AirtableOAuthConfig, refreshToken: string): Promise<AirtableTokenResponse> {
  return requestToken(config, new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}

export interface AirtableWhoAmI {
  id: string;
  scopes?: string[];
  email?: string;
}

export async function whoAmI(accessToken: string): Promise<AirtableWhoAmI> {
  const res = await fetch(AIRTABLE_WHOAMI_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable whoami failed (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as AirtableWhoAmI;
}
