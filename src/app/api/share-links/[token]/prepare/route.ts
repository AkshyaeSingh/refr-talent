import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mapRowToCandidate } from "@/lib/candidateFields";
import { EMPTY_WEIGHTED } from "@/lib/criteria";
import { autoMapColumns, parseCriteriaDoc, rankCandidates } from "@/lib/ai";
import { fetchAirtableRows, type AirtableConfig } from "@/lib/connectorSync";
import { getQsToken } from "@/lib/airtable/quickShareSession";

// Public — the giver (who need not have an account) uploads a CSV or connects
// Airtable via OAuth. We map the columns, normalize, and rank the rows against
// the asker's criteria — WITHOUT storing anything. The giver reviews, then
// calls /submit. Airtable's token comes from the OAuth session cookie set by
// /airtable/callback — never from the client.
const schema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("csv"),
    rows: z.array(z.record(z.string(), z.string())).min(1).max(5000),
  }),
  z.object({
    source: z.literal("airtable"),
    baseId: z.string().min(1),
    tableId: z.string().min(1),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link) return NextResponse.json({ error: "Invalid share link." }, { status: 404 });
  if (link.status === "CLOSED") {
    return NextResponse.json({ error: "This share link is closed." }, { status: 410 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const input = parsed.data;

  try {
    let rows: Record<string, string>[];
    if (input.source === "csv") {
      rows = input.rows;
    } else {
      const accessToken = await getQsToken();
      if (!accessToken) {
        return NextResponse.json({ error: "Airtable session expired — reconnect." }, { status: 401 });
      }
      rows = await fetchAirtableRows({
        token: accessToken,
        baseId: input.baseId,
        tableId: input.tableId,
        fieldMapping: {},
      } as AirtableConfig);
    }
    if (rows.length === 0) return NextResponse.json({ error: "No rows found." }, { status: 400 });

    const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const { mapping, includeColumns } = await autoMapColumns(headers, rows.slice(0, 4));
    const include = new Set(includeColumns);

    const normalized = rows.map((row, i) => {
      const data = mapRowToCandidate(row, mapping);
      data.rawFields = Object.fromEntries(Object.entries(row).filter(([k]) => include.has(k)));
      return { id: `row-${i}`, ...data };
    });

    const weighted = (await parseCriteriaDoc(link.criteriaText)) ?? EMPTY_WEIGHTED;
    const ranked = await rankCandidates(link.criteriaText, weighted, normalized, 30);

    return NextResponse.json({
      candidates: ranked.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        skills: c.skills,
        roleInterest: c.roleInterest,
        experienceLevel: c.experienceLevel,
        location: c.location,
        remoteOk: c.remoteOk,
        linkedinUrl: c.linkedinUrl,
        resumeUrl: c.resumeUrl,
        notes: c.notes,
        rawFields: c.rawFields,
        matchPct: c.matchPct,
        reason: c.reason,
      })),
      aiDoc: weighted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that source.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
