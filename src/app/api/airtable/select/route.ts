import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, type AirtableOAuthConfig } from "@/lib/airtable/connection";
import { fetchAirtableRows } from "@/lib/connectorSync";
import { autoMapColumns } from "@/lib/ai";
import { ingestRows } from "@/lib/ingest";
import type { Prisma } from "@/generated/prisma/client";

const schema = z.object({
  connectorId: z.string().min(1),
  baseId: z.string().min(1),
  baseName: z.string().optional(),
  tableId: z.string().min(1),
});

// User picked a base + table: pull the rows via the OAuth token, AI-map the
// columns, persist the selection on the connector, and do the first import.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { connectorId, baseId, baseName, tableId } = parsed.data;

  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.orgId !== user.orgId) {
    return NextResponse.json({ error: "Connector not found." }, { status: 404 });
  }

  try {
    const accessToken = await getValidAccessToken(connectorId);
    const rows = await fetchAirtableRows({ token: accessToken, baseId, tableId, fieldMapping: {} });
    if (rows.length === 0) return NextResponse.json({ error: "That table has no rows." }, { status: 400 });

    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const { mapping, includeColumns } = await autoMapColumns(headers, rows.slice(0, 4));

    const cfg = connector.config as unknown as AirtableOAuthConfig;
    const newCfg: AirtableOAuthConfig = {
      ...cfg,
      baseId,
      baseName,
      tableId,
      fieldMapping: mapping,
      includeColumns,
    };
    const label = baseName ? `Airtable — ${baseName}` : "Airtable";
    await prisma.connector.update({
      where: { id: connectorId },
      data: {
        config: newCfg as unknown as Prisma.InputJsonValue,
        label,
        status: "ACTIVE",
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });

    const { created, updated } = await ingestRows(user.orgId, rows, mapping, label, includeColumns);
    // Fire-and-forget AI enrichment of the new candidates.
    fetch(new URL("/api/enrich", req.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: req.headers.get("cookie") ?? "" },
      body: "{}",
    }).catch(() => {});

    return NextResponse.json({ ok: true, created, updated, fetched: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed." }, { status: 502 });
  }
}
