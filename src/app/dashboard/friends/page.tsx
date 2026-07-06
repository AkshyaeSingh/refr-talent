"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import QuickShare from "@/components/QuickShare";

const MOCK_ORG_SLUG = "mock-talent-org-demo";

type Org = { id: string; name: string; slug: string; orgType?: string | null; focusAreas?: string[] };
type Connection = {
  id: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "REVOKED";
  requestedById: string;
  shareMode: string;
  orgA: Org;
  orgB: Org;
};

// Deterministic vibrant tile color per org name (like the reference gallery).
function tileColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h}, 62%, 52%)`;
}

const SHARE_MODES = [
  { value: "MANUAL", label: "Manual sharing" },
  { value: "ALL", label: "Share all by default" },
  { value: "TOP_FITS", label: "Share top fits" },
];

export default function FriendsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [pools, setPools] = useState<Record<string, number>>({});
  const [myOrgId, setMyOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/connections");
    const data = await res.json();
    setConnections(data.connections ?? []);
    setOrgs(data.orgs ?? []);
    setPools(data.pools ?? {});
    setMyOrgId(data.myOrgId ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, no data library in use
    load();
  }, [load]);

  function otherOrg(c: Connection) {
    return c.orgA.id === myOrgId ? c.orgB : c.orgA;
  }

  const activeIds = new Set(
    connections
      .filter((c) => c.status === "APPROVED" || c.status === "PENDING")
      .map((c) => otherOrg(c).id)
  );
  const friendsList = connections.filter((c) => c.status === "APPROVED");
  const incoming = connections.filter((c) => c.status === "PENDING" && c.requestedById !== myOrgId);
  const outgoing = connections.filter((c) => c.status === "PENDING" && c.requestedById === myOrgId);
  const discover = orgs.filter((o) => !activeIds.has(o.id));

  async function request(targetOrgId: string, targetOrg?: Org) {
    setStatus(null);
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetOrgId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setStatus(data.error);
    } else if (targetOrg?.slug === MOCK_ORG_SLUG) {
      // The demo org auto-accepts server-side after ~5s; poll a bit past that
      // so the notification lands even if the request landed slightly late.
      setStatus(`Request sent to ${targetOrg.name} — waiting for them to accept…`);
      setTimeout(async () => {
        await load();
        setStatus(`🎉 ${targetOrg.name} accepted your connection request! You can now search their pool.`);
      }, 5500);
    }
    await load();
  }

  async function respond(id: string, action: "approve" | "deny" | "revoke") {
    await fetch(`/api/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  async function setShareMode(id: string, shareMode: string) {
    await fetch(`/api/connections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setShareMode", shareMode }),
    });
    await load();
  }

  if (loading) return <div className="p-8 text-sm text-neutral-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">Friends</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Friend orgs can search each other&apos;s pools and share talent. Both sides must approve,
        and each friendship has its own sharing preference.
      </p>
      {status && <p className="mb-4 text-sm text-red-600">{status}</p>}

      <QuickShare />

      {incoming.length > 0 && (
        <Section title="Requests for you">
          {incoming.map((c) => {
            const o = otherOrg(c);
            return (
              <Card key={c.id} org={o} poolSize={pools[o.id] ?? 0}>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1" onClick={() => respond(c.id, "approve")}>
                    Approve
                  </button>
                  <button className="btn-secondary flex-1" onClick={() => respond(c.id, "deny")}>
                    Deny
                  </button>
                </div>
              </Card>
            );
          })}
        </Section>
      )}

      <Section title="Your friends">
        {friendsList.length === 0 && (
          <p className="col-span-full text-sm text-neutral-400">
            No friends yet — connect with an org below to start sharing talent.
          </p>
        )}
        {friendsList.map((c) => {
          const o = otherOrg(c);
          return (
            <Card key={c.id} org={o} poolSize={pools[o.id] ?? 0}>
              <select
                className="input w-full text-xs"
                value={c.shareMode}
                onChange={(e) => setShareMode(c.id, e.target.value)}
                title="How you prefer to share data with this friend"
              >
                {SHARE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex gap-2">
                <Link href="/dashboard" className="btn-secondary flex-1 text-center">
                  Search pool
                </Link>
                <button
                  className="btn-ghost text-xs text-neutral-400 hover:text-red-600"
                  onClick={() => respond(c.id, "revoke")}
                >
                  Unfriend
                </button>
              </div>
            </Card>
          );
        })}
      </Section>

      {outgoing.length > 0 && (
        <Section title="Pending (sent by you)">
          {outgoing.map((c) => {
            const o = otherOrg(c);
            return (
              <Card key={c.id} org={o} poolSize={pools[o.id] ?? 0}>
                <button className="btn-secondary w-full" disabled>
                  Pending…
                </button>
              </Card>
            );
          })}
        </Section>
      )}

      <Section title="Orgs you may know">
        {discover.length === 0 && (
          <p className="col-span-full text-sm text-neutral-400">No other orgs to connect with yet.</p>
        )}
        {discover.map((o) => (
          <Card key={o.id} org={o} poolSize={pools[o.id] ?? 0}>
            <button className="btn-primary w-full" onClick={() => request(o.id, o)}>
              ⊕ Connect
            </button>
          </Card>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Card({
  org,
  poolSize,
  children,
}: {
  org: Org;
  poolSize: number;
  children: React.ReactNode;
}) {
  const initials = org.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div
        className="relative flex aspect-square items-center justify-center"
        style={{ backgroundColor: tileColor(org.name) }}
      >
        <span className="text-5xl font-bold text-white">{initials}</span>
        {org.slug === MOCK_ORG_SLUG && (
          <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700">
            Demo
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="truncate font-semibold">{org.name}</div>
        {org.slug === MOCK_ORG_SLUG && (
          <p className="mb-1 text-xs text-neutral-500">
            Try search without connecting your own pool first.
          </p>
        )}
        <div className="mb-2 text-xs text-neutral-500">
          {poolSize} candidate{poolSize === 1 ? "" : "s"}
          {org.orgType ? ` · ${org.orgType}` : ""}
        </div>
        {children}
      </div>
    </div>
  );
}
