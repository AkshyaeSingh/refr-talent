// Admin access is gated by an email allowlist so the operator can see the admin
// space without a separate role system. Set ADMIN_EMAILS to a comma-separated
// list of the emails allowed in; the operator's own address is allowed by
// default so it works out of the box.
const DEFAULT_ADMINS = ["akshyaesingh@gmail.com"];

export function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMINS.map((e) => e.toLowerCase()), ...fromEnv])];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
