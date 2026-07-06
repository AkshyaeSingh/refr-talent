import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ingestRows } from "@/lib/ingest";
import {
  fetchAirtableRows,
  fetchTypeformRows,
  type AirtableConfig,
  type TypeformConfig,
} from "@/lib/connectorSync";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const connector = await prisma.connector.findUnique({ where: { id } });
  if (!connector || connector.orgId !== user.orgId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (connector.type === "CSV") {
    return NextResponse.json({ error: "CSV connectors are re-uploaded, not synced." }, { status: 400 });
  }

  try {
    const config = connector.config as unknown;
    let rows: Record<string, string>[];
    let fieldMapping;
    let includeColumns: string[] | undefined;

    if (connector.type === "AIRTABLE") {
      const c = config as AirtableConfig & { includeColumns?: string[] };
      fieldMapping = c.fieldMapping;
      includeColumns = c.includeColumns;
      rows = await fetchAirtableRows(c);
    } else {
      const c = config as TypeformConfig & { includeColumns?: string[] };
      fieldMapping = c.fieldMapping;
      includeColumns = c.includeColumns;
      rows = await fetchTypeformRows(c);
    }

    const { created, updated } = await ingestRows(
      user.orgId,
      rows,
      fieldMapping,
      connector.label,
      includeColumns
    );

    await prisma.connector.update({
      where: { id },
      data: { status: "ACTIVE", lastSyncedAt: new Date(), lastError: null },
    });

    return NextResponse.json({ ok: true, created, updated, fetched: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    await prisma.connector.update({
      where: { id },
      data: { status: "ERROR", lastError: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
