import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractProfiles } from "@/lib/ai";
import type { Prisma } from "@/generated/prisma/client";

const schema = z.object({
  // Re-run extraction even for already-enriched candidates.
  all: z.boolean().optional(),
  limit: z.number().int().min(1).max(300).optional(),
});

const BATCH = 8;

// Runs AI profile extraction over the org's candidates: headline, summary,
// links, topics, credentials, audience tier, consent. Processes those missing a
// profile (or all, if asked), in batches. Safe to call repeatedly.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = schema.safeParse(await req.json().catch(() => ({})));
  const all = body.success ? body.data.all : false;
  const limit = (body.success && body.data.limit) || 120;

  const candidates = await prisma.candidate.findMany({
    where: { orgId: user.orgId, ...(all ? {} : { profileExtractedAt: null }) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, name: true, rawFields: true, notes: true, linkedinUrl: true },
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, enriched: 0, remaining: 0 });
  }

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

  const remaining = await prisma.candidate.count({
    where: { orgId: user.orgId, profileExtractedAt: null },
  });

  return NextResponse.json({ ok: true, enriched, remaining });
}
