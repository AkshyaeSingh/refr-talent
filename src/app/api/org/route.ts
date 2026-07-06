import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  return NextResponse.json({ org: user.org });
}

const schema = z.object({
  name: z.string().min(2).max(100).optional(),
  orgType: z.enum(["fellowship", "hiring", "both"]).optional(),
  focusAreas: z.array(z.string()).max(20).optional(),
  website: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  // data: URL of the uploaded logo. Capped to keep the row small.
  logoUrl: z.string().max(500_000).optional(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const org = await prisma.org.update({
    where: { id: user.orgId },
    data: parsed.data,
  });
  return NextResponse.json({ org });
}
