import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isConnectionApproved } from "@/lib/connections";
import { summarizeJourney, aiAvailable } from "@/lib/ai";

// On-demand: extract the candidate's talent-journey pipeline from their
// application answers (education → programs → orgs). Merges same-email rows in
// the org first, so the journey draws on everything known about them.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!aiAvailable) return NextResponse.json({ error: "AI is not configured." }, { status: 400 });

  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({ where: { id } });
  if (!candidate) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (candidate.orgId !== user.orgId) {
    const allowed = await isConnectionApproved(user.orgId, candidate.orgId);
    if (!allowed) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const peers = candidate.email
    ? await prisma.candidate.findMany({
        where: {
          orgId: candidate.orgId,
          email: { equals: candidate.email, mode: "insensitive" },
        },
      })
    : [candidate];

  const answers = Object.assign(
    {},
    ...peers.map((c) => (c.rawFields ?? {}) as Record<string, unknown>)
  );
  const notes = peers.map((c) => c.notes).filter(Boolean).join("\n\n") || null;

  const journey = await summarizeJourney({
    name: candidate.name,
    skills: [...new Set(peers.flatMap((c) => c.skills))],
    roleInterest: [...new Set(peers.flatMap((c) => c.roleInterest))],
    experienceLevel: peers.map((c) => c.experienceLevel).find(Boolean) ?? null,
    location: peers.map((c) => c.location).find(Boolean) ?? null,
    notes,
    answers,
  });

  if (!journey) return NextResponse.json({ error: "Couldn't map a journey from the available data." }, { status: 502 });
  return NextResponse.json(journey);
}
