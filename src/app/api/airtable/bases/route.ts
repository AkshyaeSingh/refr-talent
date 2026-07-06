import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/airtable/connection";

// Lists the Airtable bases the connected account granted this integration.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const connectorId = new URL(req.url).searchParams.get("connector");
  if (!connectorId) return NextResponse.json({ error: "Missing connector." }, { status: 400 });

  const connector = await prisma.connector.findUnique({ where: { id: connectorId } });
  if (!connector || connector.orgId !== user.orgId) {
    return NextResponse.json({ error: "Connector not found." }, { status: 404 });
  }

  try {
    const accessToken = await getValidAccessToken(connectorId);
    const res = await fetch("https://api.airtable.com/v0/meta/bases", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Airtable: ${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as { bases: { id: string; name: string }[] };
    return NextResponse.json({ bases: data.bases ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 502 });
  }
}
