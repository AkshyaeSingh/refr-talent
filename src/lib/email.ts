// Minimal transactional email via Resend's REST API. Entirely optional: when
// RESEND_API_KEY isn't set, sendEmail is a no-op that reports it didn't send,
// so callers (e.g. feedback) still persist to the DB and never fail because
// email is unconfigured.
//
// Env:
//   RESEND_API_KEY  — your Resend API key
//   EMAIL_FROM      — a verified sender, e.g. "Refr <notifications@yourdomain>"
//                     (defaults to Resend's onboarding sender for quick testing)
//   ADMIN_EMAIL     — where operator notifications go (defaults below)

export const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_EMAIL || "akshyaesingh@gmail.com";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, error: "email not configured" };

  const from = process.env.EMAIL_FROM || "Refr <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
