"use client";

import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";
import { CANDIDATE_FIELDS, type CandidateFieldKey, type FieldMapping } from "@/lib/candidateFields";
import { SourceLogo, type SourceId } from "@/components/SourceLogos";

type Connector = {
  id: string;
  type: "CSV" | "AIRTABLE" | "TYPEFORM";
  label: string;
  status: "ACTIVE" | "ERROR" | "NEVER_SYNCED";
  lastSyncedAt: string | null;
  lastError: string | null;
  needsSetup?: boolean;
};

type SourceCard = {
  id: SourceId;
  name: string;
  blurb: string;
  state: "csv" | "oauth" | "soon";
};

// The catalogue of talent sources. CSV is a one-shot upload; Airtable is a live
// OAuth connection; the rest are on the roadmap (and gather demand via the
// "suggest" card below).
const SOURCES: SourceCard[] = [
  { id: "csv", name: "CSV / Spreadsheet", blurb: "Drag in any export — we map the columns for you.", state: "csv" },
  { id: "airtable", name: "Airtable", blurb: "Authorize once; pick a base and keep it in sync.", state: "oauth" },
  { id: "typeform", name: "Typeform", blurb: "Sync form responses as applicants arrive.", state: "soon" },
  { id: "googleforms", name: "Google Forms", blurb: "Pull responses straight from your form.", state: "soon" },
  { id: "notion", name: "Notion", blurb: "Turn a Notion database into a live pool.", state: "soon" },
];

export default function ImportPanel({
  onImported,
  showSources = true,
}: {
  onImported?: () => void;
  showSources?: boolean;
}) {
  const [csvOpen, setCsvOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
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
    setCsvOpen(false);
    load();
    onImported?.();
    // Auto-build AI profiles (credentials, topics, links, consent) for the
    // freshly imported candidates. Non-blocking.
    fetch("/api/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCES.map((s) => (
          <SourceTile
            key={s.id}
            source={s}
            onCsv={() => setCsvOpen(true)}
          />
        ))}

        {/* Suggest an integration */}
        <button
          onClick={() => setSuggestOpen(true)}
          className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-neutral-300 p-4 text-left transition-colors hover:border-purple-400 hover:bg-purple-50/40"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-300 text-2xl font-light text-neutral-400">
            +
          </span>
          <div className="font-semibold">Suggest an integration</div>
          <p className="text-xs leading-5 text-neutral-500">
            Tell us which tool your applicants live in and we&apos;ll prioritize it.
          </p>
        </button>
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
                    {c.needsSetup
                      ? "Choose a base & table above to finish connecting"
                      : c.lastSyncedAt
                        ? `Last synced ${new Date(c.lastSyncedAt).toLocaleString()}`
                        : "Never synced"}
                    {c.lastError ? ` · ${c.lastError}` : ""}
                  </div>
                </div>
                {c.type !== "CSV" && !c.needsSetup && (
                  <button className="btn-secondary" onClick={() => sync(c.id)}>
                    Sync now
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {csvOpen && (
        <Modal title="Import a spreadsheet" onClose={() => setCsvOpen(false)}>
          <CsvImport onDone={() => done("Imported into your pool.")} />
        </Modal>
      )}

      {suggestOpen && (
        <Modal title="Suggest an integration" onClose={() => setSuggestOpen(false)}>
          <SuggestIntegration
            onDone={() => {
              setSuggestOpen(false);
              setStatus("Thanks — we logged your request. 🙌");
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function SourceTile({ source, onCsv }: { source: SourceCard; onCsv: () => void }) {
  const soon = source.state === "soon";
  const inner = (
    <>
      <div className="flex w-full items-start justify-between">
        <SourceLogo id={source.id} />
        {soon && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Coming soon
          </span>
        )}
      </div>
      <div className="font-semibold">{source.name}</div>
      <p className="text-xs leading-5 text-neutral-500">{source.blurb}</p>
      {!soon && (
        <span className="mt-1 text-xs font-semibold text-purple-700">
          {source.state === "oauth" ? "Connect with Airtable →" : "Import a file →"}
        </span>
      )}
    </>
  );

  const cardClass =
    "flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4 text-left transition-colors";

  if (soon) {
    return <div className={`${cardClass} cursor-default opacity-70`}>{inner}</div>;
  }
  if (source.state === "oauth") {
    return (
      <a href="/api/oauth/airtable/authorize" className={`${cardClass} hover:border-purple-300`}>
        {inner}
      </a>
    );
  }
  return (
    <button onClick={onCsv} className={`${cardClass} hover:border-purple-300`}>
      {inner}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/20 p-6" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SuggestIntegration({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return setError("Which tool would you like?");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integration-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, reason }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error ?? "Couldn't send that. Try again.");
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        What tool do your applicants live in? We use these to decide what to build next.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tool
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fillout, Greenhouse, Notion…" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Why (optional)
        <textarea
          className="input"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. our whole cohort applies through a Fillout form"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary w-fit" disabled={busy} onClick={submit}>
        {busy ? "Sending…" : "Send suggestion"}
      </button>
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
