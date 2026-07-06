import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/airtable/connection";
import { fetchAirtableRows } from "@/lib/connectorSync";
import { autoMapColumns } from "@/lib/ai";
import { detectConsent, findConsentColumn } from "@/lib/ingest";
import { CANDIDATE_FIELDS } from "@/lib/candidateFields";

export const runtime = "nodejs";

const schema = z.object({
  connectorId: z.string().min(1),
  baseId: z.string().min(1),
  tableId: z.string().min(1),
});

// Read-only DRY RUN before import: pulls the table, works out which columns
// we'd keep, which candidate fields they map to, how many applicants consented
// to being shared with partners, and a small redacted sample — so the user can
// review exactly what's about to come in (and nothing more) before confirming.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { connectorId, baseId, tableId } = parsed.data;

  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.orgId !== user.orgId) {
    return NextResponse.json({ error: "Connector not found." }, { status: 404 });
  }

  try {
    const accessToken = await getValidAccessToken(connectorId);
    const rows = await fetchAirtableRows({ token: accessToken, baseId, tableId, fieldMapping: {} });
    if (rows.length === 0) return NextResponse.json({ error: "That table has no rows." }, { status: 400 });

    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const { mapping, includeColumns } = await autoMapColumns(columns, rows.slice(0, 4));

    // Which candidate field each stored column maps to (for the "what we read" list).
    const fieldByColumn = new Map<string, string>();
    for (const f of CANDIDATE_FIELDS) {
      const col = mapping[f.key as keyof typeof mapping];
      if (col) fieldByColumn.set(col, f.label.replace(/ \(.*\)/, ""));
    }
    const storedColumns = (includeColumns ?? columns).map((col) => ({
      column: col,
      field: fieldByColumn.get(col) ?? null,
    }));

    // Consent split.
    const consentColumn = findConsentColumn(columns);
    const consented = rows.filter(detectConsent).length;
    const notConsented = rows.length - consented;

    // Small redacted sample: only the columns we'd keep, values truncated.
    const keep = new Set(includeColumns ?? columns);
    const sampleRows = rows.slice(0, 5).map((r) =>
      Object.fromEntries(
        Object.entries(r)
          .filter(([k]) => keep.has(k))
          .map(([k, v]) => [k, String(v).slice(0, 120)])
      )
    );

    return NextResponse.json({
      totalRows: rows.length,
      columns,
      storedColumns,
      consent: { column: consentColumn, consented, notConsented, hasColumn: Boolean(consentColumn) },
      sampleRows,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Preview failed." }, { status: 502 });
  }
}
