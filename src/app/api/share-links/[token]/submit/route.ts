import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const candidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  skills: z.array(z.string()).default([]),
  roleInterest: z.array(z.string()).default([]),
  experienceLevel: z.string().nullish(),
  location: z.string().nullish(),
  remoteOk: z.boolean().default(false),
  linkedinUrl: z.string().nullish(),
  resumeUrl: z.string().nullish(),
  notes: z.string().nullish(),
  rawFields: z.record(z.string(), z.unknown()).nullish(),
});

const schema = z.object({
  giverLabel: z.string().max(120).optional(),
  candidates: z.array(candidateSchema).min(1).max(2000),
});

// Public — the giver commits the candidates they chose to share. They land
// directly in the asker org's pool, provenance-labelled, deduped by email.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({ where: { token } });
  if (!link) return NextResponse.json({ error: "Invalid share link." }, { status: 404 });
  if (link.status === "CLOSED") {
    return NextResponse.json({ error: "This share link is closed." }, { status: 410 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { giverLabel, candidates } = parsed.data;
  const orgId = link.askerOrgId;
  const originLabel = giverLabel?.trim() || `Quick share`;

  // Dedup by email against the asker's existing pool.
  const emails = [
    ...new Set(candidates.map((c) => c.email?.toLowerCase()).filter((e): e is string => Boolean(e))),
  ];
  const existing = emails.length
    ? await prisma.candidate.findMany({
        where: { orgId, email: { in: emails, mode: "insensitive" } },
        select: { email: true },
      })
    : [];
  const have = new Set(existing.map((c) => c.email!.toLowerCase()));

  const toCreate = candidates.filter((c) => {
    const key = c.email?.toLowerCase();
    return !key || !have.has(key);
  });

  let createdIds: string[] = [];
  if (toCreate.length > 0) {
    const created = await prisma.candidate.createManyAndReturn({
      data: toCreate.map((c) => ({
        orgId,
        name: c.name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        skills: c.skills,
        roleInterest: c.roleInterest,
        experienceLevel: c.experienceLevel ?? null,
        location: c.location ?? null,
        remoteOk: c.remoteOk,
        linkedinUrl: c.linkedinUrl ?? null,
        resumeUrl: c.resumeUrl ?? null,
        notes: c.notes ?? null,
        rawFields: (c.rawFields ?? undefined) as Prisma.InputJsonValue | undefined,
        originLabel,
      })),
      select: { id: true },
    });
    createdIds = created.map((c) => c.id);
    await prisma.candidateEvent.createMany({
      data: createdIds.map((candidateId) => ({
        candidateId,
        orgId,
        type: "PULLED_IN" as const,
        description: `Received via quick share from ${originLabel}`,
      })),
    });
  }

  await prisma.shareLink.update({
    where: { id: link.id },
    data: {
      status: "RECEIVED",
      receivedCount: { increment: createdIds.length },
      receivedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    shared: createdIds.length,
    skippedDuplicates: candidates.length - createdIds.length,
  });
}
