import { NextResponse } from "next/server";
import { getQsToken } from "@/lib/airtable/quickShareSession";

// Lists the Airtable bases the giver's OAuth session granted access to.
export async function GET() {
  const accessToken = await getQsToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Airtable session expired — reconnect." }, { status: 401 });
  }

  try {
    const res = await fetch("https://api.airtable.com/v0/meta/bases", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: `Airtable: ${res.status}` }, { status: 502 });
    const data = (await res.json()) as { bases: { id: string; name: string }[] };
    return NextResponse.json({ bases: data.bases ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed." }, { status: 502 });
  }
}
