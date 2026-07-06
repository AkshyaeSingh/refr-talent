import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Public endpoint (no auth) — the landing page's waitlist form. Access to the
// talent network is invite-only; entries are reviewed manually before an org
// account is created, so this only ever records a request.
const schema = z.object({
  orgName: z.string().min(2).max(120),
  orgType: z.enum(["fellowship", "hiring", "both"]),
  contactName: z.string().min(1).max(100),
  email: z.string().email().max(200),
  website: z.string().max(300).optional(),
  message: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fill in the required fields." }, { status: 400 });
  }
  const { orgName, orgType, contactName, email, website, message } = parsed.data;

  try {
    await prisma.waitlistEntry.create({
      data: {
        orgName: orgName.trim(),
        orgType,
        contactName: contactName.trim(),
        email: email.trim().toLowerCase(),
        website: website?.trim() || null,
        message: message?.trim() || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    // Unique constraint on email — they're already on the list.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
      return NextResponse.json({ ok: true, already: true });
    }
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
