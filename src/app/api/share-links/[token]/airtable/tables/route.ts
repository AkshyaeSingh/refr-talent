import { NextResponse } from "next/server";
import { getQsToken } from "@/lib/airtable/quickShareSession";

// Lists the tables in a base so the giver can pick which one to share from.
export async function GET(req: Request) {
  const accessToken = await getQsToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Airtable session expired — reconnect." }, { status: 401 });
  }

  const baseId = new URL(req.url).searchParams.get("baseId");
  if (!baseId) return NextResponse.json({ error: "Missing baseId." }, { status: 400 });

  try {
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
