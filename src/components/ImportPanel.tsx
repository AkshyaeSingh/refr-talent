"use client";

import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import { CANDIDATE_FIELDS, type CandidateFieldKey, type FieldMapping } from "@/lib/candidateFields";

type Connector = {
  id: string;
  type: "CSV" | "AIRTABLE" | "TYPEFORM";
  label: string;
  status: "ACTIVE" | "ERROR" | "NEVER_SYNCED";
  lastSyncedAt: string | null;
  lastError: string | null;
};

type Kind = "csv" | "airtable" | "typeform";

const SOURCES: { kind: Kind; name: string; blurb: string; color: string; mark: string }[] = [
  { kind: "csv", name: "CSV / Spreadsheet", blurb: "Drag in any export — we map the columns for you.", color: "bg-neutral-900", mark: "⌗" },
  { kind: "airtable", name: "Airtable", blurb: "Connect a base; stays in sync as applicants land.", color: "bg-[#fcb400]", mark: "A" },
  { kind: "typeform", name: "Typeform", blurb: "Sync form responses automatically.", color: "bg-neutral-800", mark: "T" },
];

export default function ImportPanel({
  onImported,
  showSources = true,
}: {
  onImported?: () => void;
  showSources?: boolean;
}) {
  const [open, setOpen] = useState<Kind | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/connectors");
    if (res.ok) setConnectors((await res.json()).connectors ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    if (showSources) load();
  }, [load, showSources]);

  function done(msg: string) {
    setStatus(`${msg} ✨ Analyzing profiles…`);
    setOpen(null);
    load();
    onImported?.();
    // Auto-build AI profiles (credentials, topics, links, consent) for the
    // freshly imported candidates. Non-blocking.
    fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setStatus(`${msg} Analyzed ${d.enriched} profiles.`);
      })
      .catch(() => {});
  }

  async function sync(id: string) {
    setStatus("Syncing…");
    const res = await fetch(`/api/connectors/${id}/sync`, { method: "POST" });
    const data = await res.json();
    setStatus(res.ok ? `Synced ${data.created} new, ${data.updated} updated.` : `Sync error: ${data.error}`);
    load();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SOURCES.map((s) => (
          <button
            key={s.kind}
            onClick={() => setOpen(s.kind)}
            className="card flex flex-col gap-2 text-left transition-colors hover:border-purple-300"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color} text-lg font-bold text-white`}>
              {s.mark}
            </div>
            <div className="font-semibold">{s.name}</div>
            <p className="text-xs leading-5 text-neutral-500">{s.blurb}</p>
          </button>
        ))}
      </div>

      {status && <p className="text-sm text-purple-700">{status}</p>}

      {showSources && connectors.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            Connected sources
          </h3>
          <div className="card flex flex-col divide-y divide-neutral-100">
            {connectors.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {c.label}
                    <span className="badge">{c.type.toLowerCase()}</span>
                    {c.status === "ERROR" && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600">error</span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {c.lastSyncedAt ? `Last synced ${new Date(c.lastSyncedAt).toLocaleString()}` : "Never synced"}
                    {c.lastError ? ` · ${c.lastError}` : ""}
                  </div>
                </div>
                {c.type !== "CSV" && (
                  <button className="btn-secondary" onClick={() => sync(c.id)}>
                    Sync now
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/20 p-6" onClick={() => setOpen(null)}>
          <div
            className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {open === "csv" ? "Import a spreadsheet" : `Connect ${open === "airtable" ? "Airtable" : "Typeform"}`}
              </h2>
              <button className="btn-ghost" onClick={() => setOpen(null)}>✕</button>
            </div>
            {open === "csv" ? (
              <CsvImport onDone={() => done("Imported into your pool.")} />
            ) : (
              <ApiConnect type={open === "airtable" ? "AIRTABLE" : "TYPEFORM"} onDone={(n) => done(`Connected — pulled ${n} applicants.`)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CsvImport({ onDone }: { onDone: () => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [include, setInclude] = useState<string[]>([]);
  const [mapping_ready, setReady] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback((file: File) => {
    setError(null);
    setReady(false);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const fields = results.meta.fields ?? [];
        setHeaders(fields);
        setRows(results.data);
        // AI (or heuristic) auto-map — no manual mapping needed.
        const res = await fetch("/api/import/automap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headers: fields, sampleRows: results.data.slice(0, 4) }),
        });
        const data = await res.json();
        setMapping(data.mapping ?? {});
        setInclude(data.includeColumns ?? fields);
        setReady(true);
      },
      error: (err) => setError(err.message),
    });
  }, []);

  async function submit() {
    if (!mapping.name) return setError("Couldn't find a name column — adjust below.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: fileName ?? "CSV import", mapping, rows, includeColumns: include }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(typeof data.error === "string" ? data.error : "Import failed.");
    onDone();
  }

  if (rows.length === 0) {
    return (
      <>
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) parseFile(f); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-12 text-center text-sm text-neutral-500 ${
            dragOver ? "border-purple-500 bg-purple-50" : "border-neutral-300"
          }`}
        >
          <span className="text-2xl">📄</span>
          <span>Drop a CSV, or click to choose. We&apos;ll figure out the columns.</span>
          <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
        </label>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </>
    );
  }

  const mapped = CANDIDATE_FIELDS.filter((f) => mapping[f.key]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>{fileName} · {rows.length} rows</span>
        <button className="btn-ghost" onClick={() => { setRows([]); setHeaders([]); setFileName(null); }}>
          Choose different file
        </button>
      </div>

      {!mapping_ready ? (
        <p className="text-sm text-neutral-500">✨ Reading your columns…</p>
      ) : (
        <>
          <div className="rounded-xl bg-purple-50/60 p-3 text-sm">
            <div className="mb-1 font-medium text-purple-900">✨ Detected {mapped.length} fields</div>
            <div className="flex flex-wrap gap-1.5">
              {mapped.map((f) => (
                <span key={f.key} className="badge-match">
                  {f.label.replace(/ \(.*\)/, "")} ← {mapping[f.key]}
                </span>
              ))}
            </div>
          </div>

          <button className="btn-ghost w-fit text-xs" onClick={() => setAdjust((v) => !v)}>
            {adjust ? "Hide" : "Adjust columns"}
          </button>
          {adjust && (
            <div className="grid grid-cols-2 gap-3">
              {CANDIDATE_FIELDS.map((field) => (
                <label key={field.key} className="flex flex-col gap-1 text-sm">
                  <span>{field.label}{field.required && <span className="text-red-600"> *</span>}</span>
                  <select
                    className="input"
                    value={mapping[field.key as CandidateFieldKey] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || undefined })}
                  >
                    <option value="">— none —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-fit" disabled={busy} onClick={submit}>
            {busy ? "Importing…" : `Import ${rows.length} candidates`}
          </button>
        </>
      )}
    </div>
  );
}

function ApiConnect({ type, onDone }: { type: "AIRTABLE" | "TYPEFORM"; onDone: (n: number) => void }) {
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [baseId, setBaseId] = useState("");
  const [tableId, setTableId] = useState("");
  const [formId, setFormId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    const body =
      type === "AIRTABLE"
        ? { type, label: label || "Airtable", token, baseId, tableId }
        : { type, label: label || "Typeform", token, formId };
    const res = await fetch("/api/connectors/auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(typeof data.error === "string" ? data.error : "Could not connect.");
    onDone((data.created ?? 0) + (data.updated ?? 0));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        Paste your credentials — we pull the applicants and map the columns automatically.
      </p>
      <Field label="Label"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={`${type === "AIRTABLE" ? "Airtable" : "Typeform"} — Cohort 8`} /></Field>
      <Field label="Access token"><input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="pat… / tfp…" /></Field>
      {type === "AIRTABLE" ? (
        <>
          <Field label="Base ID"><input className="input" value={baseId} onChange={(e) => setBaseId(e.target.value)} placeholder="app…" /></Field>
          <Field label="Table ID or name"><input className="input" value={tableId} onChange={(e) => setTableId(e.target.value)} placeholder="Applicants" /></Field>
        </>
      ) : (
        <Field label="Form ID"><input className="input" value={formId} onChange={(e) => setFormId(e.target.value)} placeholder="AbCdEf" /></Field>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-fit" disabled={busy} onClick={submit}>
        {busy ? "Connecting…" : "Connect & sync"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-sm font-medium">{label}{children}</label>;
}
