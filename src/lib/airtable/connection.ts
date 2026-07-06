import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import type { FieldMapping } from "@/lib/candidateFields";
import type { Prisma } from "@/generated/prisma/client";
import {
  getAirtableOAuthConfig,
  refreshAccessToken,
  type AirtableTokenResponse,
} from "./oauth";

// An OAuth-connected Airtable source is stored as a normal Connector row
// (type = AIRTABLE) whose config carries the encrypted tokens plus, once the
// user picks one, the base/table + field mapping used at sync time.
export type AirtableOAuthConfig = {
  oauth: true;
  airtableUserId: string;
  scopes: string;
  accessToken: string; // encrypted
  accessTokenExpiresAt: string; // ISO
  refreshToken: string; // encrypted
  refreshTokenExpiresAt: string | null;
  baseId?: string;
  baseName?: string;
  tableId?: string;
  fieldMapping?: FieldMapping;
  includeColumns?: string[];
};

const EXPIRY_SAFETY_MARGIN_MS = 60_000;

function tokenConfigFields(token: AirtableTokenResponse) {
  return {
    scopes: token.scope ?? "",
    accessToken: encrypt(token.accessToken),
    accessTokenExpiresAt: token.accessTokenExpiresAt.toISOString(),
    refreshToken: encrypt(token.refreshToken),
    refreshTokenExpiresAt: token.refreshTokenExpiresAt?.toISOString() ?? null,
  };
}

// Persist (or update) the org's Airtable OAuth connection. Keyed by the
// Airtable user id inside config so re-connecting the same account updates the
// existing connector rather than piling up duplicates.
export async function saveAirtableConnection(
  orgId: string,
  airtableUserId: string,
  token: AirtableTokenResponse
) {
  const existing = await prisma.connector.findFirst({
    where: { orgId, type: "AIRTABLE" },
  });
  const maybeCfg = existing ? (existing.config as unknown as AirtableOAuthConfig | null) : null;
  const existingCfg = maybeCfg?.oauth ? maybeCfg : null;

  const config: AirtableOAuthConfig = {
    oauth: true,
    airtableUserId,
    // preserve a previously-chosen base/table on reconnect
    baseId: existingCfg?.baseId,
    baseName: existingCfg?.baseName,
    tableId: existingCfg?.tableId,
    fieldMapping: existingCfg?.fieldMapping,
    includeColumns: existingCfg?.includeColumns,
    ...tokenConfigFields(token),
  };

  if (existing && existingCfg && existingCfg.airtableUserId === airtableUserId) {
    return prisma.connector.update({
      where: { id: existing.id },
      data: { config: config as unknown as Prisma.InputJsonValue, status: "ACTIVE", lastError: null },
    });
  }
  return prisma.connector.create({
    data: {
      orgId,
      type: "AIRTABLE",
      label: "Airtable",
      config: config as unknown as Prisma.InputJsonValue,
      status: "NEVER_SYNCED",
    },
  });
}

// Returns a valid access token for a connector, refreshing via the stored
// refresh token if the current one is expired/near-expiry, and persisting the
// rotated tokens.
export async function getValidAccessToken(connectorId: string): Promise<string> {
  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector) throw new Error("Connector not found.");
  const cfg = connector.config as unknown as AirtableOAuthConfig;
  if (!cfg?.oauth) throw new Error("Not an OAuth Airtable connector.");

  const expired = new Date(cfg.accessTokenExpiresAt).getTime() - EXPIRY_SAFETY_MARGIN_MS < Date.now();
  if (!expired) return decrypt(cfg.accessToken);

  const refreshed = await refreshAccessToken(getAirtableOAuthConfig(), decrypt(cfg.refreshToken));
  const newCfg: AirtableOAuthConfig = { ...cfg, ...tokenConfigFields(refreshed) };
  await prisma.connector.update({
    where: { id: connectorId },
    data: { config: newCfg as unknown as Prisma.InputJsonValue },
  });
  return refreshed.accessToken;
}
