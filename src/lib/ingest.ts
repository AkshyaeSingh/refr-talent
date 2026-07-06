import { prisma } from "@/lib/prisma";
import { mapRowToCandidate, type FieldMapping } from "@/lib/candidateFields";

type IngestResult = { created: number; updated: number };

// Identifies a "share with partners" / "consent to share" style column name,
// if the source has one. Used both to gate consent and to show the user, before
// import, exactly which column we're reading consent from.
export function findConsentColumn(headers: string[]): string | null {
  for (const k of headers) {
    const key = k.toLowerCase();
    if (
      (key.includes("shar") && (key.includes("partner") || key.includes("information") || key.includes("org"))) ||
      (key.includes("consent") && key.includes("shar"))
    ) {
      return k;
    }
  }
  return null;
}

// Best-effort consent detection from the raw row: if there's a "share with
// partners" style question answered No, the candidate is not shareable across
// orgs. Defaults to true when no such question exists. AI enrichment later
// refines this, but we set it at the door so consent is never ignored.
export function detectConsent(row: Record<string, string>): boolean {
  for (const [k, v] of Object.entries(row)) {
    const key = k.toLowerCase();
    if (
      (key.includes("shar") && (key.includes("partner") || key.includes("information") || key.includes("org"))) ||
      (key.includes("consent") && key.includes("shar"))
    ) {
      const val = String(v).toLowerCase().trim();
      if (/\bno\b|not open|decline|opt.?out|unwilling/.test(val)) return false;
    }
  }
  return true;
}

// Upserts a batch of raw rows into an org's pool using a field mapping.
// - Dedup key is email (case-insensitive) within the org, so re-syncing a
//   connected source updates existing candidates instead of duplicating them.
//   Rows without an email are always inserted.
// - includeColumns (when provided) limits which raw columns are stored on the
//   candidate — the importer chooses what's relevant; everything else is
//   dropped at the door and never persisted.
// - Batched: one dedup lookup + createMany for the whole batch, instead of
//   per-row round trips.
export async function ingestRows(
  orgId: string,
  rows: Record<string, string>[],
  mapping: FieldMapping,
  sourceLabel: string,
  includeColumns?: string[]
): Promise<IngestResult> {
  const include = includeColumns ? new Set(includeColumns) : null;

  const prepared = rows.map((row) => {
    const base = mapRowToCandidate(row, mapping);
    const rawFields = include
      ? Object.fromEntries(Object.entries(row).filter(([k]) => include.has(k)))
      : base.rawFields;
    return { ...base, rawFields, consentToShare: detectConsent(row) };
  });

  // One query to find all existing candidates that match by email.
  const emails = [...new Set(prepared.map((p) => p.email?.toLowerCase()).filter((e): e is string => Boolean(e)))];
  const existing = emails.length
    ? await prisma.candidate.findMany({
        where: { orgId, email: { in: emails, mode: "insensitive" } },
        select: { id: true, email: true },
      })
    : [];
  const existingByEmail = new Map(existing.map((c) => [c.email!.toLowerCase(), c.id]));

  const toCreate: typeof prepared = [];
  const toUpdate: { id: string; data: (typeof prepared)[number] }[] = [];
  for (const data of prepared) {
    const key = data.email?.toLowerCase();
    const id = key ? existingByEmail.get(key) : undefined;
    if (id) toUpdate.push({ id, data });
    else toCreate.push(data);
  }

  // Creates: bulk insert, then bulk-record IMPORTED events.
  let createdIds: string[] = [];
  if (toCreate.length > 0) {
    const created = await prisma.candidate.createManyAndReturn({
      data: toCreate.map((data) => ({ orgId, ...data })),
      select: { id: true },
    });
    createdIds = created.map((c) => c.id);
    await prisma.candidateEvent.createMany({
      data: createdIds.map((candidateId) => ({
        candidateId,
        orgId,
        type: "IMPORTED" as const,
        description: `Imported from ${sourceLabel}`,
      })),
    });
  }

  // Updates: usually a small set on re-sync.
  for (const { id, data } of toUpdate) {
    await prisma.candidate.update({ where: { id }, data });
  }
  if (toUpdate.length > 0) {
    await prisma.candidateEvent.createMany({
      data: toUpdate.map(({ id }) => ({
        candidateId: id,
        orgId,
        type: "UPDATED" as const,
        description: `Updated from ${sourceLabel}`,
      })),
    });
  }

  return { created: toCreate.length, updated: toUpdate.length };
}
