import { prisma } from "@/lib/prisma";
import { getValidAccessToken, type AirtableOAuthConfig } from "@/lib/airtable/connection";
import { fetchAirtableRows } from "@/lib/connectorSync";
import { ingestRows } from "@/lib/ingest";
import { enrichOrgCandidates } from "@/lib/enrich";

// Weekly re-sync of connected Airtable sources. This app runs as a persistent
// Node process (see DEPLOY.md), so a plain interval is enough — no external
// cron needed. Every ~6h we look for OAuth-connected Airtable connectors that
// haven't synced in a week and pull them again, then analyze the new rows.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 30_000;

let started = false;

async function syncDue() {
  const cutoff = new Date(Date.now() - WEEK_MS);
  const connectors = await prisma.connector.findMany({
    where: {
      type: "AIRTABLE",
      status: "ACTIVE",
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
    },
  });

  for (const connector of connectors) {
    const cfg = connector.config as unknown as AirtableOAuthConfig;
    if (!cfg?.oauth || !cfg.baseId || !cfg.tableId) continue;
    try {
      const token = await getValidAccessToken(connector.id);
      const rows = await fetchAirtableRows({
        token,
        baseId: cfg.baseId,
        tableId: cfg.tableId,
        fieldMapping: cfg.fieldMapping ?? {},
      });
      await ingestRows(connector.orgId, rows, cfg.fieldMapping ?? {}, connector.label, cfg.includeColumns);
      await prisma.connector.update({
        where: { id: connector.id },
        data: { lastSyncedAt: new Date(), lastError: null },
      });
      // Analyze any newly-imported profiles so search stays accurate.
      await enrichOrgCandidates(connector.orgId).catch(() => {});
    } catch (e) {
      console.error("auto-sync failed for connector", connector.id, e);
      await prisma.connector
        .update({
          where: { id: connector.id },
          data: { lastError: e instanceof Error ? e.message : "auto-sync failed" },
        })
        .catch(() => {});
    }
  }
}

export function startAutoSync() {
  if (started) return;
  started = true;
  setTimeout(() => void syncDue().catch(() => {}), FIRST_RUN_DELAY_MS);
  setInterval(() => void syncDue().catch(() => {}), CHECK_INTERVAL_MS);
}
