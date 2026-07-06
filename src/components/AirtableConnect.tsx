"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Base = { id: string; name: string };
type Table = { id: string; name: string };
type Preview = {
  totalRows: number;
  columns: string[];
  storedColumns: { column: string; field: string | null }[];
  consent: { column: string | null; consented: number; notConsented: number; hasColumn: boolean };
  sampleRows: Record<string, string>[];
};

type Stage = "bases" | "tables" | "review";

function AirtableConnectInner({ onImported }: { onImported?: () => void }) {
  const params = useSearchParams();
  const status = params.get("airtable");
  const connectorFromUrl = params.get("connector");

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("bases");
  const [connectorId, setConnectorId] = useState<string | null>(null);
  const [bases, setBases] = useState<Base[] | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [tables, setTables] = useState<Table[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Review-before-import state.
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pendingTable, setPendingTable] = useState<Table | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());

  const loadBases = useCallback(async (cid: string) => {
    setBusy(true);
    setErr(null);
    setStage("bases");
    setOpen(true);
    const res = await fetch(`/api/airtable/bases?connector=${cid}`);
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(d.error ?? "Couldn't list bases.");
    const list: Base[] = d.bases ?? [];
    setBases(list);
    // If they granted access to exactly one base, skip straight to its tables.
    if (list.length === 1) pickBase(list[0], cid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the picker automatically when we come back from the OAuth grant (or
  // find a connection still mid-setup), so the user lands right on "pick a table".
  useEffect(() => {
    if (status === "connected" && connectorFromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the OAuth redirect query param
      setConnectorId(connectorFromUrl);
      loadBases(connectorFromUrl);
      return;
    }
    if (status === "error") {
      setErr(params.get("message") ?? "Airtable connection failed.");
      setOpen(true);
      return;
    }
    if (status === "unconfigured") {
      setErr("Airtable OAuth isn't configured on this server yet (see .env.example).");
      setOpen(true);
      return;
    }
    fetch("/api/connectors")
      .then((r) => r.json())
      .then((d) => {
        const pending = ((d.connectors ?? []) as { id: string; type: string; needsSetup?: boolean }[]).find(
          (c) => c.type === "AIRTABLE" && c.needsSetup
        );
        if (pending) {
          setConnectorId(pending.id);
          loadBases(pending.id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, connectorFromUrl]);

  async function pickBase(b: Base, cid?: string) {
    setBaseId(b.id);
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/airtable/tables?connector=${cid ?? connectorId}&baseId=${b.id}`);
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(d.error ?? "Couldn't list tables.");
    setTables(d.tables ?? []);
    setStage("tables");
  }

  // A read-only dry run so the user can review what comes in before storing it.
  async function pickTable(t: Table) {
    setBusy(true);
    setErr(null);
    setMsg("Reading the table (read-only)…");
    const res = await fetch("/api/airtable/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorId, baseId, tableId: t.id }),
    });
    const d = await res.json();
    setBusy(false);
    setMsg(null);
    if (!res.ok) return setErr(d.error ?? "Couldn't read that table.");
    const pv = d as Preview;
    setPreview(pv);
    setPendingTable(t);
    setSelectedCols(new Set(pv.storedColumns.map((s) => s.column)));
    setStage("review");
  }

  function toggleCol(col: string) {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }

  async function confirmImport() {
    if (!pendingTable) return;
    setBusy(true);
    setErr(null);
    setMsg("✨ Importing and mapping columns…");
    const base = bases?.find((b) => b.id === baseId);
    const res = await fetch("/api/airtable/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectorId,
        baseId,
        baseName: base?.name,
        tableId: pendingTable.id,
        includeColumns: [...selectedCols],
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(null);
      return setErr(d.error ?? "Import failed.");
    }
    reset();
    setMsg(`Imported ${d.created} new, ${d.updated} updated from ${base?.name} · ${pendingTable.name}.`);
    onImported?.();
  }

  function reset() {
    setOpen(false);
    setStage("bases");
    setConnectorId(null);
    setBases(null);
    setBaseId(null);
    setTables(null);
    setPreview(null);
    setPendingTable(null);
    setErr(null);
  }

  const showStatusLine = Boolean(msg) && !open;

  return (
    <>
      {showStatusLine && <p className="rounded-xl bg-purple-50 px-3 py-2 text-sm text-purple-700">{msg}</p>}

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/25 p-6" onClick={reset}>
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-[#fcb400] text-[10px] font-bold text-white">A</span>
                {stage === "review" ? "Review before importing" : "Connect Airtable"}
              </h2>
              <button className="btn-ghost" onClick={reset}>✕</button>
            </div>

            {msg && <p className="mt-2 text-sm text-purple-700">{msg}</p>}
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

            {/* Base picker */}
            {stage === "bases" && (
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium text-neutral-600">Choose a base</div>
                {!bases && <p className="text-sm text-neutral-400">Loading your bases…</p>}
                <div className="flex flex-wrap gap-2">
                  {bases?.length === 0 && <p className="text-sm text-neutral-400">No bases shared with the app.</p>}
                  {bases?.map((b) => (
                    <button key={b.id} className="chip" disabled={busy} onClick={() => pickBase(b)}>
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Table picker */}
            {stage === "tables" && (
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium text-neutral-600">Choose a table to import</div>
                <div className="flex flex-wrap gap-2">
                  {tables?.length === 0 && <p className="text-sm text-neutral-400">No tables in this base.</p>}
                  {tables?.map((t) => (
                    <button key={t.id} className="chip" disabled={busy} onClick={() => pickTable(t)}>
                      {t.name}
                    </button>
                  ))}
                </div>
                {bases && bases.length > 1 && (
                  <button className="btn-ghost mt-3 text-xs" onClick={() => setStage("bases")}>← Back to bases</button>
                )}
              </div>
            )}

            {/* Review + column selection */}
            {stage === "review" && preview && pendingTable && (
              <ReviewPane
                preview={preview}
                tableName={pendingTable.name}
                selectedCols={selectedCols}
                onToggleCol={toggleCol}
                busy={busy}
                onBack={() => setStage("tables")}
                onConfirm={confirmImport}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ReviewPane({
  preview,
  tableName,
  selectedCols,
  onToggleCol,
  busy,
  onBack,
  onConfirm,
}: {
  preview: Preview;
  tableName: string;
  selectedCols: Set<string>;
  onToggleCol: (col: string) => void;
  busy: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { totalRows, storedColumns, consent, sampleRows } = preview;
  const shownCols = storedColumns.filter((s) => selectedCols.has(s.column)).map((s) => s.column);

  return (
    <div className="mt-2">
      <p className="text-sm text-neutral-500">
        From <span className="font-medium text-neutral-700">{tableName}</span> — {totalRows} row{totalRows === 1 ? "" : "s"}.
        Nothing is stored until you confirm.
      </p>

      {/* Consent */}
      <div className="mt-4 rounded-xl border border-neutral-200 p-3">
        <div className="text-sm font-semibold">Consent to share</div>
        {consent.hasColumn ? (
          <p className="mt-1 text-sm text-neutral-600">
            Reading consent from{" "}
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">{consent.column}</span>.{" "}
            <span className="font-semibold text-emerald-700">{consent.consented}</span> said yes and will be
            discoverable to partner orgs.{" "}
            {consent.notConsented > 0 && (
              <>
                <span className="font-semibold text-neutral-700">{consent.notConsented}</span> did not — they stay
                private to you and are never shared across orgs.
              </>
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-700">
            No “share with partners” column was found, so we can’t confirm per-applicant consent from this table.
            Everyone imports into your own pool; add a consent question and re-sync so only those who said yes become
            discoverable.
          </p>
        )}
      </div>

      {/* Column selection */}
      <div className="mt-4">
        <div className="text-sm font-semibold">Columns to import</div>
        <p className="text-xs text-neutral-500">
          Tick the columns you want stored. Everything unticked is ignored and never leaves Airtable.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {storedColumns.map((s) => {
            const on = selectedCols.has(s.column);
            return (
              <button
                key={s.column}
                onClick={() => onToggleCol(s.column)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  on
                    ? "border-purple-300 bg-purple-50 text-purple-800"
                    : "border-neutral-200 bg-neutral-50 text-neutral-400 line-through"
                }`}
              >
                {on ? "✓ " : ""}{s.column}
                {s.field && <span className={`ml-1 ${on ? "text-purple-500" : "text-neutral-300"}`}>→ {s.field}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sample */}
      {sampleRows.length > 0 && shownCols.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-semibold">Sample ({sampleRows.length} of {totalRows})</div>
          <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>{shownCols.map((c) => <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>)}</tr>
              </thead>
              <tbody>
                {sampleRows.map((r, i) => (
                  <tr key={i} className="border-t border-neutral-100">
                    {shownCols.map((c) => (
                      <td key={c} className="max-w-[180px] truncate px-2 py-1.5 text-neutral-700">{r[c] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security */}
      <div className="mt-4 rounded-xl bg-neutral-50 p-3">
        <div className="text-sm font-semibold">This connection is secure</div>
        <ul className="mt-1.5 flex flex-col gap-1 text-xs text-neutral-600">
          <li>🔒 <span className="font-medium">Read-only.</span> We requested read access only (<code>data.records:read</code>, <code>schema.bases:read</code>) — we can’t create, edit, or delete anything in your Airtable.</li>
          <li>🎯 <span className="font-medium">Scoped.</span> We only see the base and table you picked. Your other bases and workspaces stay invisible to us.</li>
          <li>🛡️ <span className="font-medium">Encrypted.</span> Your Airtable token is encrypted at rest (AES-256-GCM) and the connection runs over HTTPS.</li>
        </ul>
      </div>

      <div className="mt-5 flex justify-between gap-2">
        <button className="btn-ghost" onClick={onBack} disabled={busy}>← Back</button>
        <button className="btn-primary" onClick={onConfirm} disabled={busy || selectedCols.size === 0}>
          {busy ? "Importing…" : `Import ${totalRows} applicant${totalRows === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}

export default function AirtableConnect({ onImported }: { onImported?: () => void }) {
  return (
    <Suspense fallback={null}>
      <AirtableConnectInner onImported={onImported} />
    </Suspense>
  );
}
