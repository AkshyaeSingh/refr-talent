import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { deriveOrgFromWebsite, aiAvailable } from "@/lib/ai";

export const runtime = "nodejs";

const schema = z.object({ website: z.string().min(3).max(300) });

// Given a website/program link, derive a draft org profile (name, one-liner,
// type, focus areas) the onboarding form pre-fills for the user to edit. This
// only returns the draft — it does NOT persist anything; the user reviews and
// saves via PATCH /api/org.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  if (!aiAvailable) {
    return NextResponse.json(
      { error: "Auto-fill needs an ANTHROPIC_API_KEY. You can fill the details in manually." },
      { status: 503 }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const derived = await deriveOrgFromWebsite(parsed.data.website);
  if (!derived) {
    return NextResponse.json(
      { error: "Couldn't read that site. Check the link, or fill the details in manually." },
      { status: 422 }
    );
  }
  return NextResponse.json({ derived });
}
