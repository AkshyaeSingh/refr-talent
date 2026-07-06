import { prisma } from "@/lib/prisma";
import { extractProfiles } from "@/lib/ai";
import type { Prisma } from "@/generated/prisma/client";

const BATCH = 8;

// Runs AI profile extraction (headline, summary, links, topics, credentials,
// audience tier, consent) over an org's candidates — those missing a profile by
// default, or all of them. Shared by the /api/enrich route and the weekly
// auto-sync so every imported profile ends up analyzed automatically.
export async function enrichOrgCandidates(
  orgId: string,
  opts?: { all?: boolean; limit?: number }
): Promise<{ enriched: number; remaining: number }> {
  const all = opts?.all ?? false;
  const limit = opts?.limit ?? 120;

  const candidates = await prisma.candidate.findMany({
    where: { orgId, ...(all ? {} : { profileExtractedAt: null }) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, name: true, rawFields: true, notes: true, linkedinUrl: true },
  });
  if (candidates.length === 0) return { enriched: 0, remaining: 0 };

  let enriched = 0;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const chunk = candidates.slice(i, i + BATCH);
    const raw = chunk.map((c) => ({
      name: c.name,
      ...(typeof c.rawFields === "object" && c.rawFields ? (c.rawFields as Record<string, unknown>) : {}),
      notes: c.notes ?? undefined,
      linkedin: c.linkedinUrl ?? undefined,
    }));
    const profiles = await extractProfiles(raw);

    await Promise.all(
      chunk.map((c, j) => {
        const p = profiles[j];
        return prisma.candidate.update({
          where: { id: c.id },
          data: {
            headline: p.headline,
            summary: p.summary,
            links: (p.links ?? {}) as Prisma.InputJsonValue,
            topics: p.topics,
            credentials: p.credentials,
            audienceTier: p.audienceTier,
            consentToShare: p.consentToShare,
            profileExtractedAt: new Date(),
          },
        });
      })
    );
    enriched += chunk.length;
  }

  const remaining = await prisma.candidate.count({ where: { orgId, profileExtractedAt: null } });
  return { enriched, remaining };
}
