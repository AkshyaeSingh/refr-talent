import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const search = await prisma.savedSearch.findUnique({ where: { id } });
  if (!search || search.orgId !== user.orgId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await prisma.savedSearch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
