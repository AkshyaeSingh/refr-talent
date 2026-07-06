import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgs = await prisma.org.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { candidates: true, users: true, savedSearches: true, connectors: true } },
      users: { select: { email: true, name: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  });
  return NextResponse.json({ orgs });
}
