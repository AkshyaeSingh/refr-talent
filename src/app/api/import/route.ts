import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ingestRows } from "@/lib/ingest";
import type { FieldMapping } from "@/lib/candidateFields";

const schema = z.object({
  label: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.string())).min(1).max(5000),
  // Which raw columns to keep on the stored candidate. Omitted = keep all.
  includeColumns: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { label, mapping, rows, includeColumns } = parsed.data;
  const fieldMapping = mapping as FieldMapping;

  // Record the CSV upload as a one-shot connector for traceability.
  await prisma.connector.create({
    data: {
      orgId: user.orgId,
      type: "CSV",
      label,
      config: { fieldMapping, includeColumns: includeColumns ?? null },
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
  });

  const { created, updated } = await ingestRows(
    user.orgId,
    rows,
    fieldMapping,
    label,
    includeColumns
  );

  return NextResponse.json({ ok: true, created, updated, imported: created + updated });
}
