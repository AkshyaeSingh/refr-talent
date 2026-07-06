"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Base = { id: string; name: string };
type Table = { id: string; name: string };

function AirtableConnectInner({ onImported }: { onImported?: () => void }) {
  const params = useSearchParams();
  const status = params.get("airtable");
  const connectorFromUrl = params.get("connector");

  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [bases, setBases] = useState<Base[] | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadBases = useCallback(async (cid: string) => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/airtable/bases?connector=${cid}`);
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(d.error ?? "Couldn't list bases.");
    setBases(d.bases ?? []);
  }, []);

  // Just came back from the OAuth redirect with a connector id → start the picker.
  useEffect(() => {
    if (status === "connected" && connectorFromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the OAuth redirect query param
      setConnectorId(connectorFromUrl);
      loadBases(connectorFromUrl);
    } else if (status === "error") {
      setErr(params.get("message") ?? "Airtable connection failed.");
    } else if (status === "unconfigured") {
      setErr("Airtable OAuth isn't configured on this server yet (see .env.example). You can still connect with a token below.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, connectorFromUrl]);

  async function pickBase(b: Base) {
    setBaseId(b.id);
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/airtable/tables?connector=${connectorId}&baseId=${b.id}`);
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(d.error ?? "Couldn't list tables.");
    setTables(d.tables ?? []);
  }

  async function pickTable(t: Table) {
    setBusy(true);
    setErr(null);
    setMsg("✨ Importing and mapping columns…");
    const base = bases?.find((b) => b.id === baseId);
    const res = await fetch("/api/airtable/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorId, baseId, baseName: base?.name, tableId: t.id }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(null);
      return setErr(d.error ?? "Import failed.");
    }
    setMsg(`Imported ${d.created} new, ${d.updated} updated from ${base?.name} · ${t.name}.`);
    setBases(null);
    setTables(null);
    setConnectorId(null);
    onImported?.();
  }

  const picking = connectorId && (bases || busy);

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#fcb400] text-[10px] font-bold text-white">A</span>
            Connect Airtable (one click)
          </h2>
          <p className="text-xs text-neutral-500">
            Authorize with Airtable — no API keys. Pick a base and table; we map the columns and keep
            it in sync.
          </p>
        </div>
        {!picking && (
          <a href="/api/oauth/airtable/authorize" className="btn-primary whitespace-nowrap">
            Connect with Airtable
          </a>
        )}
      </div>

      {msg && <p className="mt-3 text-sm text-purple-700">{msg}</p>}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      {/* Base picker */}
      {connectorId && bases && !tables && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-neutral-500">Choose a base</div>
          <div className="flex flex-wrap gap-2">
            {bases.length === 0 && <p className="text-sm text-neutral-400">No bases shared with the app.</p>}
            {bases.map((b) => (
              <button key={b.id} className="chip" disabled={busy} onClick={() => pickBase(b)}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table picker */}
      {connectorId && tables && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-medium text-neutral-500">Choose a table to import</div>
          <div className="flex flex-wrap gap-2">
            {tables.map((t) => (
              <button key={t.id} className="chip" disabled={busy} onClick={() => pickTable(t)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function AirtableConnect({ onImported }: { onImported?: () => void }) {
  return (
    <Suspense fallback={null}>
      <AirtableConnectInner onImported={onImported} />
    </Suspense>
  );
}
