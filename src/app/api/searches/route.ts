import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const searches = await prisma.savedSearch.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ searches });
}

const schema = z.object({
  name: z.string().min(1),
  query: z.string().default(""),
  criteria: z.record(z.string(), z.unknown()).default({}),
  targetOrgId: z.string().optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { name, query, criteria, targetOrgId } = parsed.data;

  const search = await prisma.savedSearch.create({
    data: {
      orgId: user.orgId,
      createdById: user.id,
      name,
      query,
      criteria: criteria as Prisma.InputJsonValue,
      targetOrgId: targetOrgId ?? null,
    },
  });
  return NextResponse.json({ search });
}
