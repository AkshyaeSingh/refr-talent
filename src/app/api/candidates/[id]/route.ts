import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isConnectionApproved } from "@/lib/connections";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      originOrg: { select: { name: true } },
      org: { select: { id: true, name: true, slug: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!candidate) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Viewable if it's in your pool, or in an approved connection's pool.
  if (candidate.orgId !== user.orgId) {
    const allowed = await isConnectionApproved(user.orgId, candidate.orgId);
    if (!allowed) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Merge same-person duplicates WITHIN the same org (same email) into one
  // profile — e.g. the person was imported from two sources, or pulled from
  // two friends. Non-destructive: we merge at read time, rows stay separate.
  let mergedFrom = 0;
  let sources: string[] = [];
  const merged = { ...candidate };

  if (candidate.email) {
    const peers = await prisma.candidate.findMany({
      where: {
        orgId: candidate.orgId,
        email: { equals: candidate.email, mode: "insensitive" },
        id: { not: candidate.id },
      },
      include: {
        originOrg: { select: { name: true } },
        events: { orderBy: { createdAt: "asc" } },
      },
    });

    if (peers.length > 0) {
      mergedFrom = peers.length;
      const all = [candidate, ...peers];

      merged.skills = [...new Set(all.flatMap((c) => c.skills))];
      merged.roleInterest = [...new Set(all.flatMap((c) => c.roleInterest))];
      merged.phone = all.map((c) => c.phone).find(Boolean) ?? null;
      merged.experienceLevel = all.map((c) => c.experienceLevel).find(Boolean) ?? null;
      merged.location = all.map((c) => c.location).find(Boolean) ?? null;
      merged.linkedinUrl = all.map((c) => c.linkedinUrl).find(Boolean) ?? null;
      merged.resumeUrl = all.map((c) => c.resumeUrl).find(Boolean) ?? null;
      merged.remoteOk = all.some((c) => c.remoteOk);
      merged.notes = all.map((c) => c.notes).filter(Boolean).join("\n\n") || null;

      // Union of all raw application answers across the merged rows.
      merged.rawFields = Object.assign(
        {},
        ...all.map((c) => (c.rawFields ?? {}) as Record<string, unknown>)
      );

      // Combined, time-ordered history across every merged row.
      merged.events = all
        .flatMap((c) => c.events)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // Where each row came from (origin org or quick-share label).
      sources = [
        ...new Set(
          all.map((c) => c.originOrg?.name ?? c.originLabel ?? candidate.org.name)
        ),
      ];
    }
  }

  return NextResponse.json({ candidate: merged, mergedFrom, sources });
}
