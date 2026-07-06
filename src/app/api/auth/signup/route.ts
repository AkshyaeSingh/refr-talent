import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { deriveOrgFromWebsite } from "@/lib/ai";

export const runtime = "nodejs";

const schema = z.object({
  orgName: z.string().min(2),
  website: z.string().min(3),
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

// Cap how long we'll wait on the website read + AI derivation during signup —
// account creation must never hang on a slow/unreachable site.
const ENRICH_BUDGET_MS = 15_000;

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { orgName, website, name, email, password } = parsed.data;

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
    const org = await tx.org.create({ data: { name: orgName, slug, website } });
    const user = await tx.user.create({
      data: { orgId: org.id, name, email, passwordHash, role: "ADMIN" },
    });
    return { org, user };
  });

  await createSession({ userId: user.id, orgId: org.id });

  // Best-effort: pre-fill the org profile (description, type, focus areas)
  // from their website, so onboarding opens already populated instead of
  // blank. Never blocks/fails signup — the org name and website the user
  // typed are the source of truth either way.
  try {
    const derived = await Promise.race([
      deriveOrgFromWebsite(website),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ENRICH_BUDGET_MS)),
    ]);
    if (derived) {
      await prisma.org.update({
        where: { id: org.id },
        data: {
          description: derived.description ?? undefined,
          orgType: derived.orgType ?? undefined,
          focusAreas: derived.focusAreas.length > 0 ? derived.focusAreas : undefined,
        },
      });
    }
  } catch {
    // Site unreachable, AI unavailable, etc. — onboarding just shows blank
    // fields for the user to fill in manually.
  }

  return NextResponse.json({ ok: true });
}
