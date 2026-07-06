import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { enrichOrgCandidates } from "@/lib/enrich";

export const runtime = "nodejs";

const schema = z.object({
  // Re-run extraction even for already-enriched candidates.
  all: z.boolean().optional(),
  limit: z.number().int().min(1).max(300).optional(),
});

// Runs AI profile extraction over the org's candidates. Safe to call
// repeatedly. Enrichment also runs automatically after each import and on the
// weekly auto-sync, so this is mostly a manual backfill entry point.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const all = body.success ? body.data.all : false;
  const limit = body.success ? body.data.limit : undefined;

  const { enriched, remaining } = await enrichOrgCandidates(user.orgId, { all, limit });
  return NextResponse.json({ ok: true, enriched, remaining });
}
