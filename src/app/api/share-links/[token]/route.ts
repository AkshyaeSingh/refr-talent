import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public — no auth. Returns just enough for the giver to see the ask.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { askerOrg: { select: { name: true } } },
  });
  if (!link) return NextResponse.json({ error: "This share link is invalid." }, { status: 404 });

  return NextResponse.json({
    title: link.title,
    criteriaText: link.criteriaText,
    askerOrgName: link.askerOrg.name,
    status: link.status,
  });
}
