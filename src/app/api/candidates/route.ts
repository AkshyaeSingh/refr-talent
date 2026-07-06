import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isConnectionApproved } from "@/lib/connections";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId") || user.orgId;
  const q = searchParams.get("q")?.trim();

  if (orgId !== user.orgId) {
    const allowed = await isConnectionApproved(user.orgId, orgId);
    if (!allowed) {
      return NextResponse.json({ error: "No approved connection with that org." }, { status: 403 });
    }
  }

  const where: Record<string, unknown> = { orgId };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { experienceLevel: { contains: q, mode: "insensitive" } },
      { skills: { has: q } },
      { roleInterest: { has: q } },
    ];
  }

  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { originOrg: { select: { name: true } } },
    take: 500,
  });

  return NextResponse.json({ candidates });
}
