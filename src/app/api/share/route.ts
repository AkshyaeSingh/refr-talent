import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isConnectionApproved } from "@/lib/connections";
import type { Prisma } from "@/generated/prisma/client";

const schema = z.object({
  type: z.enum(["PUSH", "PULL"]),
  candidateIds: z.array(z.string()).min(1).max(1000),
  // PUSH: org to send candidates to. PULL: org to pull candidates from.
  otherOrgId: z.string().min(1),
  filterCriteria: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { type, candidateIds, otherOrgId, filterCriteria } = parsed.data;

  if (otherOrgId === user.orgId) {
    return NextResponse.json({ error: "Cannot share with your own org." }, { status: 400 });
  }
  const approved = await isConnectionApproved(user.orgId, otherOrgId);
  if (!approved) {
    return NextResponse.json({ error: "No approved connection with that org." }, { status: 403 });
  }

  const fromOrgId = type === "PUSH" ? user.orgId : otherOrgId;
  const toOrgId = type === "PUSH" ? otherOrgId : user.orgId;

  // Only candidates who consented to cross-org sharing can move between pools.
  const sourceCandidates = await prisma.candidate.findMany({
    where: { id: { in: candidateIds }, orgId: fromOrgId, consentToShare: true },
  });
  if (sourceCandidates.length === 0) {
    return NextResponse.json({ error: "No matching candidates found." }, { status: 404 });
  }

  // Skip candidates that are already a copy in the target org (avoid dupes
  // if the same person gets pushed/pulled more than once).
  const existingCopies = await prisma.candidate.findMany({
    where: { orgId: toOrgId, originCandidateId: { in: sourceCandidates.map((c) => c.id) } },
    select: { originCandidateId: true },
  });
  const alreadyCopied = new Set(existingCopies.map((c) => c.originCandidateId));
  const toCopy = sourceCandidates.filter((c) => !alreadyCopied.has(c.id));

  const [fromOrg, toOrg] = await Promise.all([
    prisma.org.findUnique({ where: { id: fromOrgId }, select: { name: true } }),
    prisma.org.findUnique({ where: { id: toOrgId }, select: { name: true } }),
  ]);

  for (const c of toCopy) {
    const copy = await prisma.candidate.create({
      data: {
        orgId: toOrgId,
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
        rawFields: c.rawFields ?? undefined,
        originOrgId: fromOrgId,
        originCandidateId: c.id,
      },
    });
    // History on the new copy (arrived) and on the source (sent out).
    await prisma.candidateEvent.createMany({
      data: [
        {
          candidateId: copy.id,
          orgId: toOrgId,
          type: "PULLED_IN",
          description: `Received from ${fromOrg?.name ?? "another org"} via ${type.toLowerCase()}`,
        },
        {
          candidateId: c.id,
          orgId: fromOrgId,
          type: "PUSHED_OUT",
          description: `Shared with ${toOrg?.name ?? "another org"} via ${type.toLowerCase()}`,
        },
      ],
    });
  }

  const shareAction = await prisma.shareAction.create({
    data: {
      type,
      scope: candidateIds.length === 1 ? "SINGLE" : "LIST",
      fromOrgId,
      toOrgId,
      initiatedById: user.id,
      candidateId: candidateIds.length === 1 ? sourceCandidates[0]?.id : null,
      filterCriteria: filterCriteria as Prisma.InputJsonValue | undefined,
      candidateCount: sourceCandidates.length,
    },
  });

  return NextResponse.json({
    ok: true,
    shareAction,
    copied: toCopy.length,
    skippedAlreadyCopied: sourceCandidates.length - toCopy.length,
  });
}
