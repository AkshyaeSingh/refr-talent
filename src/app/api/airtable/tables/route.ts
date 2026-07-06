import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/airtable/connection";

// Lists the tables in a base so the user can pick which one to import.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const connectorId = searchParams.get("connector");
  const baseId = searchParams.get("baseId");
  if (!connectorId || !baseId) {
    return NextResponse.json({ error: "Missing connector or baseId." }, { status: 400 });
  }

  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.orgId !== user.orgId) {
    return NextResponse.json({ error: "Connector not found." }, { status: 404 });
  }

  try {
    const accessToken = await getValidAccessToken(connectorId);
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: `Airtable: ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { tables: { id: string; name: string }[] };
    return NextResponse.json({ tables: data.tables ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 502 });
  }
}
