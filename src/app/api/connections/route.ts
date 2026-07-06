import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const [connections, orgs, poolCounts] = await Promise.all([
    prisma.orgConnection.findMany({
      where: { OR: [{ orgAId: user.orgId }, { orgBId: user.orgId }] },
      include: { orgA: true, orgB: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.org.findMany({
      where: { id: { not: user.orgId } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, orgType: true, focusAreas: true },
    }),
    prisma.candidate.groupBy({ by: ["orgId"], _count: { _all: true } }),
  ]);

  const pools = Object.fromEntries(poolCounts.map((p) => [p.orgId, p._count._all]));

  return NextResponse.json({ connections, myOrgId: user.orgId, orgs, pools });
}

const createSchema = z.object({ targetOrgId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { targetOrgId } = parsed.data;
  if (targetOrgId === user.orgId) {
    return NextResponse.json({ error: "Cannot connect to your own org." }, { status: 400 });
  }

  const targetOrg = await prisma.org.findUnique({ where: { id: targetOrgId } });
  if (!targetOrg) {
    return NextResponse.json({ error: "Org not found." }, { status: 404 });
  }

  const existing = await prisma.orgConnection.findFirst({
    where: {
      OR: [
        { orgAId: user.orgId, orgBId: targetOrgId },
        { orgAId: targetOrgId, orgBId: user.orgId },
      ],
    },
  });
  if (existing) {
    return NextResponse.json({ error: "A connection already exists with this org." }, { status: 409 });
  }

  const connection = await prisma.orgConnection.create({
    data: {
      orgAId: user.orgId,
      orgBId: targetOrgId,
      requestedById: user.orgId,
      status: "PENDING",
    },
  });

  return NextResponse.json({ connection });
}
