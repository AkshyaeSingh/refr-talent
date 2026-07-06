import { cookies } from "next/headers";
import { encrypt, decrypt } from "@/lib/crypto";

// Short-lived, cookie-scoped Airtable OAuth session for the public quick-share
// page — the giver here has no Refr account, so we can't persist a Connector
// tied to an org. The exchanged access token lives only in an encrypted,
// httpOnly cookie for a few minutes: long enough to pick a base/table and
// pull rows, never written to the database.
export const QS_STATE_COOKIE = "qs_airtable_state";
export const QS_VERIFIER_COOKIE = "qs_airtable_verifier";
export const QS_TOKEN_COOKIE = "qs_airtable_token";
export const QS_COOKIE_PATH = "/api/share-links";

const baseOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: QS_COOKIE_PATH,
};

export async function setQsOAuthCookies(state: string, verifier: string) {
  const store = await cookies();
  store.set(QS_STATE_COOKIE, state, { ...baseOpts, maxAge: 600 });
  store.set(QS_VERIFIER_COOKIE, verifier, { ...baseOpts, maxAge: 600 });
}

export async function readQsOAuthCookies() {
  const store = await cookies();
  return { state: store.get(QS_STATE_COOKIE)?.value, verifier: store.get(QS_VERIFIER_COOKIE)?.value };
}

export async function clearQsOAuthCookies() {
  const store = await cookies();
  store.delete({ name: QS_STATE_COOKIE, path: QS_COOKIE_PATH });
  store.delete({ name: QS_VERIFIER_COOKIE, path: QS_COOKIE_PATH });
}

export async function setQsToken(accessToken: string) {
  const store = await cookies();
  store.set(QS_TOKEN_COOKIE, encrypt(accessToken), { ...baseOpts, maxAge: 900 });
}

export async function getQsToken(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(QS_TOKEN_COOKIE)?.value;
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch {
    return null;
  }
}
