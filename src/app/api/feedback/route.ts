import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, ADMIN_NOTIFY_EMAIL } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({
  message: z.string().min(1).max(4000),
  path: z.string().max(300).optional(),
});

// In-app feedback from the help widget. Always stored; also emailed to the
// operator instantly when email is configured (never blocks the response).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  const { message, path } = parsed.data;

  await prisma.feedback.create({
    data: {
      orgId: user.orgId,
      userEmail: user.email,
      userName: user.name,
      message: message.trim(),
      path: path ?? null,
    },
  });

  // Notify the operator. Fire-and-forget so a slow/unconfigured mailer never
  // makes the user wait or see an error.
  sendEmail({
    to: ADMIN_NOTIFY_EMAIL,
    subject: `Refr feedback from ${user.org.name}`,
    replyTo: user.email,
    text:
      `${user.name} (${user.email}) at ${user.org.name} wrote:\n\n` +
      `${message.trim()}\n\n` +
      (path ? `Page: ${path}\n` : "") +
      `\n— sent from the Refr help widget`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
