import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const links = await prisma.shareLink.findMany({
    where: { askerOrgId: user.orgId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ links });
}

const schema = z.object({
  title: z.string().min(1).max(120),
  criteriaText: z.string().min(1).max(5000),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const token = randomBytes(12).toString("base64url");
  const link = await prisma.shareLink.create({
    data: {
      token,
      askerOrgId: user.orgId,
      createdById: user.id,
      title: parsed.data.title,
      criteriaText: parsed.data.criteriaText,
    },
  });

  return NextResponse.json({ link });
}
