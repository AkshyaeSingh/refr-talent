import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const COLUMNS = [
  "name",
  "email",
  "phone",
  "skills",
  "roleInterest",
  "experienceLevel",
  "location",
  "remoteOk",
  "linkedinUrl",
  "resumeUrl",
  "notes",
  "sourceOrg",
] as const;

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// Exports the org's pool as a flat CSV (Airtable/Sheets-ready) so orgs can take
// their combined + pulled-in pool back out. Two-way: import in, export out.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthenticated", { status: 401 });

  const candidates = await prisma.candidate.findMany({
    where: { orgId: user.orgId },
    orderBy: { createdAt: "desc" },
    include: { originOrg: { select: { name: true } } },
    take: 10000,
  });

  const header = COLUMNS.join(",");
  const lines = candidates.map((c) => {
    const row: Record<string, string> = {
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      skills: c.skills.join("; "),
      roleInterest: c.roleInterest.join("; "),
      experienceLevel: c.experienceLevel ?? "",
      location: c.location ?? "",
      remoteOk: c.remoteOk ? "yes" : "no",
      linkedinUrl: c.linkedinUrl ?? "",
      resumeUrl: c.resumeUrl ?? "",
      notes: c.notes ?? "",
      sourceOrg: c.originOrg?.name ?? user.org.name,
    };
    return COLUMNS.map((col) => csvCell(row[col])).join(",");
  });

  const csv = [header, ...lines].join("\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="refr-pool-${date}.csv"`,
    },
  });
}
