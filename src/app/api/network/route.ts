import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the whole talent-sharing network: one node per org (sized by pool),
// and one directed edge per (from -> to) pair aggregating how many candidates
// have flowed between them. Only aggregate counts are exposed here — no
// candidate PII — so the full network can be shown to any member org.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const [orgs, poolCounts, shares] = await Promise.all([
    prisma.org.findMany({ select: { id: true, name: true } }),
    prisma.candidate.groupBy({ by: ["orgId"], _count: { _all: true } }),
    prisma.shareAction.groupBy({
      by: ["fromOrgId", "toOrgId"],
      _sum: { candidateCount: true },
    }),
  ]);

  const poolByOrg = new Map(poolCounts.map((p) => [p.orgId, p._count._all]));

  const sent = new Map<string, number>();
  const received = new Map<string, number>();
  const edges = shares.map((s) => {
    const count = s._sum.candidateCount ?? 0;
    sent.set(s.fromOrgId, (sent.get(s.fromOrgId) ?? 0) + count);
    received.set(s.toOrgId, (received.get(s.toOrgId) ?? 0) + count);
    return { source: s.fromOrgId, target: s.toOrgId, count };
  });

  const nodes = orgs.map((o) => {
    const s = sent.get(o.id) ?? 0;
    const r = received.get(o.id) ?? 0;
    const net = s - r;
    let category: "source" | "balanced" | "receiver";
    if (s === 0 && r === 0) category = "balanced";
    else if (net > 0) category = "source";
    else if (net < 0) category = "receiver";
    else category = "balanced";

    return {
      id: o.id,
      name: o.name,
      poolSize: poolByOrg.get(o.id) ?? 0,
      sent: s,
      received: r,
      category,
      isMe: o.id === user.orgId,
    };
  });

  return NextResponse.json({ nodes, edges, myOrgId: user.orgId });
}
