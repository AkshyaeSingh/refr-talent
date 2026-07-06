import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { autoMapColumns } from "@/lib/ai";

const schema = z.object({
  headers: z.array(z.string()).min(1).max(200),
  sampleRows: z.array(z.record(z.string(), z.string())).max(10).default([]),
});

// Given the columns (and a few sample rows) of an upload, returns an AI-derived
// mapping onto our canonical fields plus which raw columns are worth keeping —
// so the importer doesn't hand-map anything.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const result = await autoMapColumns(parsed.data.headers, parsed.data.sampleRows);
  return NextResponse.json(result);
}
