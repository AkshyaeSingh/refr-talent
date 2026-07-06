import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

const schema = z.object({
  orgName: z.string().min(2),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { orgName, name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const baseSlug = slugify(orgName) || "org";
  let slug = baseSlug;
  let n = 1;
  while (await prisma.org.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${++n}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { org, user } = await prisma.$transaction(async (tx) => {
    const org = await tx.org.create({ data: { name: orgName, slug } });
    const user = await tx.user.create({
      data: { orgId: org.id, name, email, passwordHash, role: "ADMIN" },
    });
    return { org, user };
  });

  await createSession({ userId: user.id, orgId: org.id });

  return NextResponse.json({ ok: true });
}
