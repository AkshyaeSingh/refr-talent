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

  // Review-before-import state.
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pendingTable, setPendingTable] = useState<Table | null>(null);

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
  // Otherwise (fresh page load, or a reload that dropped the redirect's query
  // params before the base/table was picked) check for a connector that's
  // still mid-setup and resume the picker for it, so it's never left stranded
  // with no way to finish short of the raw "Sync now" button.
  useEffect(() => {
    if (status === "connected" && connectorFromUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the OAuth redirect query param
      setConnectorId(connectorFromUrl);
      loadBases(connectorFromUrl);
      return;
    }
    if (status === "error") {
      setErr(params.get("message") ?? "Airtable connection failed.");
      return;
    }
    if (status === "unconfigured") {
      setErr("Airtable OAuth isn't configured on this server yet (see .env.example). You can still connect with a token below.");
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

  // Step 1 of import: a read-only dry run so the user can review exactly what
  // comes in (columns, consent split, a sample) before anything is stored.
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
    setPreview(d as Preview);
    setPendingTable(t);
  }

  // Step 2: the user confirmed → do the real import.
  async function confirmImport() {
    if (!pendingTable) return;
    setBusy(true);
    setErr(null);
    setMsg("✨ Importing and mapping columns…");
    const base = bases?.find((b) => b.id === baseId);
    const res = await fetch("/api/airtable/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorId, baseId, baseName: base?.name, tableId: pendingTable.id }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMsg(null);
      return setErr(d.error ?? "Import failed.");
    }
    setMsg(`Imported ${d.created} new, ${d.updated} updated from ${base?.name} · ${pendingTable.name}.`);
    setPreview(null);
    setPendingTable(null);
    setBases(null);
    setTables(null);
    setConnectorId(null);
    onImported?.();
  }

  // The Airtable source tile (in ImportPanel) starts the OAuth flow, so this
  // component is only the "finish setup" surface: it appears when we've come
  // back from Airtable (or found a connection still mid-setup) and shows the
  // base/table picker plus any status. It renders nothing when idle.
  const active = Boolean(connectorId) || Boolean(msg) || Boolean(err);
  if (!active) return null;

  return (
    <section className="card border-purple-200 bg-purple-50/30">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-[#fcb400] text-[10px] font-bold text-white">A</span>
        Finish connecting Airtable
      </h2>

      {msg && <p className="mt-2 text-sm text-purple-700">{msg}</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      {connectorId && !bases && !err && (
        <p className="mt-2 text-sm text-neutral-500">Loading your bases…</p>
      )}

      {/* Base picker */}
      {connectorId && bases && !tables && (
        <div className="mt-3">
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
        <div className="mt-3">
          <div className="mb-2 text-xs font-medium text-neutral-500">Choose a table to review</div>
          <div className="flex flex-wrap gap-2">
            {tables.map((t) => (
              <button key={t.id} className="chip" disabled={busy} onClick={() => pickTable(t)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review-before-import modal */}
      {preview && pendingTable && (
        <ReviewModal
          preview={preview}
          tableName={pendingTable.name}
          busy={busy}
          onCancel={() => { setPreview(null); setPendingTable(null); }}
          onConfirm={confirmImport}
        />
      )}
    </section>
  );
}

function ReviewModal({
  preview,
  tableName,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: Preview;
  tableName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { totalRows, storedColumns, consent, sampleRows } = preview;
  const keptCols = storedColumns.map((s) => s.column);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/25 p-6" onClick={onCancel}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">Review before importing</h2>
          <button className="btn-ghost" onClick={onCancel}>✕</button>
        </div>
        <p className="text-sm text-neutral-500">
          From <span className="font-medium text-neutral-700">{tableName}</span> — {totalRows} row{totalRows === 1 ? "" : "s"}.
          Nothing is stored until you confirm.
        </p>

        {/* Consent */}
        <div className="mt-4 rounded-xl border border-neutral-200 p-3">
          <div className="text-sm font-semibold">Consent to share</div>
          {consent.hasColumn ? (
            <p className="mt-1 text-sm text-neutral-600">
              Reading consent from the column{" "}
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
              Everyone imports into your own pool; add a consent question (e.g. “OK to share with partner orgs?”) and
              re-sync so only those who said yes become discoverable.
            </p>
          )}
        </div>

        {/* What we read */}
        <div className="mt-4">
          <div className="text-sm font-semibold">Columns we’ll read</div>
          <p className="text-xs text-neutral-500">Only these are stored. Anything else in the table is ignored.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {storedColumns.map((s) => (
              <span key={s.column} className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs">
                {s.column}
                {s.field && <span className="ml-1 text-purple-600">→ {s.field}</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Sample */}
        {sampleRows.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold">Sample ({sampleRows.length} of {totalRows})</div>
            <div className="mt-2 overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>{keptCols.map((c) => <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>)}</tr>
                </thead>
                <tbody>
                  {sampleRows.map((r, i) => (
                    <tr key={i} className="border-t border-neutral-100">
                      {keptCols.map((c) => (
                        <td key={c} className="max-w-[180px] truncate px-2 py-1.5 text-neutral-700">{r[c] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Security assurances */}
        <div className="mt-4 rounded-xl bg-neutral-50 p-3">
          <div className="text-sm font-semibold">This connection is secure</div>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-neutral-600">
            <li>🔒 <span className="font-medium">Read-only.</span> We requested read access only (<code>data.records:read</code>, <code>schema.bases:read</code>) — we can’t create, edit, or delete anything in your Airtable.</li>
            <li>🎯 <span className="font-medium">Scoped.</span> We only see the base and table you picked. Your other bases and workspaces stay invisible to us.</li>
            <li>🛡️ <span className="font-medium">Encrypted.</span> Your Airtable token is encrypted at rest (AES-256-GCM) and the connection runs over HTTPS.</li>
          </ul>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm} disabled={busy}>
            {busy ? "Importing…" : `Import ${totalRows} applicant${totalRows === 1 ? "" : "s"}`}
          </button>
        </div>
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
