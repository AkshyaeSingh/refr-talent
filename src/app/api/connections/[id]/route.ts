import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.union([
  z.object({ action: z.enum(["approve", "deny", "revoke"]) }),
  z.object({
    action: z.literal("setShareMode"),
    shareMode: z.enum(["MANUAL", "ALL", "TOP_FITS"]),
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const connection = await prisma.orgConnection.findUnique({ where: { id } });
  if (!connection) {
    return NextResponse.json({ error: "Connection not found." }, { status: 404 });
  }
  if (connection.orgAId !== user.orgId && connection.orgBId !== user.orgId) {
    return NextResponse.json({ error: "Not part of this connection." }, { status: 403 });
  }

  const { action } = parsed.data;

  if (action === "setShareMode") {
    if (connection.status !== "APPROVED") {
      return NextResponse.json({ error: "Connection is not approved yet." }, { status: 400 });
    }
    const updated = await prisma.orgConnection.update({
      where: { id },
      data: { shareMode: parsed.data.shareMode },
    });
    return NextResponse.json({ connection: updated });
  }

  if (action === "approve" || action === "deny") {
    // Only the org that did NOT send the request can approve/deny it.
    if (connection.requestedById === user.orgId) {
      return NextResponse.json({ error: "You cannot approve your own request." }, { status: 400 });
    }
    if (connection.status !== "PENDING") {
      return NextResponse.json({ error: "Connection is no longer pending." }, { status: 400 });
    }
  }

  const status = action === "approve" ? "APPROVED" : action === "deny" ? "DENIED" : "REVOKED";

  const updated = await prisma.orgConnection.update({
    where: { id },
    data: { status, respondedAt: new Date() },
  });

  return NextResponse.json({ connection: updated });
}
