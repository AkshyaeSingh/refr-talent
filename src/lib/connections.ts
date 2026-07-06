import { prisma } from "@/lib/prisma";

// Returns the other org id + connection row for every APPROVED connection
// this org is part of.
export async function getApprovedConnections(orgId: string) {
  const rows = await prisma.orgConnection.findMany({
    where: {
      status: "APPROVED",
      OR: [{ orgAId: orgId }, { orgBId: orgId }],
    },
    include: { orgA: true, orgB: true },
  });

  return rows.map((row) => ({
    connectionId: row.id,
    org: row.orgAId === orgId ? row.orgB : row.orgA,
  }));
}

export async function isConnectionApproved(orgId: string, otherOrgId: string) {
  if (orgId === otherOrgId) return true;
  const row = await prisma.orgConnection.findFirst({
    where: {
      status: "APPROVED",
      OR: [
        { orgAId: orgId, orgBId: otherOrgId },
        { orgAId: otherOrgId, orgBId: orgId },
      ],
    },
  });
  return Boolean(row);
}
