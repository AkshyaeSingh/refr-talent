import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2).max(150).optional(),
  orgType: z.enum(["fellowship", "hiring", "both"]).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  focusAreas: z.array(z.string()).max(20).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const org = await prisma.org.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ org });
}

// Permanently removes an org and everything tied to it: candidates, users,
// connectors, saved searches, import batches, share links/actions, and its
// connection edges. Also scrubs any OTHER org's data that merely referenced
// this org's candidates (copies via push/pull), so nothing is left dangling.
// Irreversible — the admin UI requires typing the org's name to confirm.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const org = await prisma.org.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.$transaction([
    // Scrub cross-org references to this org's candidates before deleting them.
    prisma.candidate.updateMany({ where: { originCandidate: { orgId: id } }, data: { originCandidateId: null } }),
    prisma.shareAction.updateMany({ where: { candidate: { orgId: id } }, data: { candidateId: null } }),
    prisma.candidate.updateMany({ where: { originOrgId: id }, data: { originOrgId: null } }),
    // Delete this org's own data, in FK-safe order.
    prisma.candidate.deleteMany({ where: { orgId: id } }),
    prisma.orgConnection.deleteMany({ where: { OR: [{ orgAId: id }, { orgBId: id }] } }),
    prisma.shareAction.deleteMany({ where: { OR: [{ fromOrgId: id }, { toOrgId: id }] } }),
    prisma.connector.deleteMany({ where: { orgId: id } }),
    prisma.savedSearch.deleteMany({ where: { orgId: id } }),
    prisma.importBatch.deleteMany({ where: { orgId: id } }),
    prisma.shareLink.deleteMany({ where: { askerOrgId: id } }),
    prisma.feedback.deleteMany({ where: { orgId: id } }),
    prisma.integrationSuggestion.deleteMany({ where: { orgId: id } }),
    prisma.user.deleteMany({ where: { orgId: id } }),
    prisma.org.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
