import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1).max(80),
  reason: z.string().max(500).optional(),
});

// Records a user's request for an integration we don't support yet, so we can
// prioritize the connector roadmap by real demand.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Tell us which tool you'd like." }, { status: 400 });

  await prisma.integrationSuggestion.create({
    data: {
      orgId: user.orgId,
      name: parsed.data.name.trim(),
      reason: parsed.data.reason?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true });
}
