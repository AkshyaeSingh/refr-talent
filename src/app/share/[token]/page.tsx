"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import Logo from "@/components/Logo";
import ContourBackground from "@/components/ContourBackground";
import { VALUE_POINTS, TAGLINE_A, TAGLINE_B } from "@/lib/marketing";

type LinkInfo = { title: string; criteriaText: string; askerOrgName: string; status: string };

type Prepared = {
  id: string;
  name: string;
  email?: string | null;
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string | null;
  location?: string | null;
  remoteOk: boolean;
  matchPct: number;
  reason?: string | null;
  [k: string]: unknown;
};

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<"intro" | "source" | "review" | "done">("intro");
  const [prepared, setPrepared] = useState<Prepared[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [giverLabel, setGiverLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ shared: number; skippedDuplicates: number } | null>(null);
  const [connectKind, setConnectKind] = useState<"airtable" | "typeform" | null>(null);

  useEffect(() => {
    fetch(`/api/share-links/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo)
      .catch(() => setNotFound(true));
  }, [token]);

  async function prepare(body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/share-links/${token}/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not read that source.");
    const cands: Prepared[] = data.candidates ?? [];
    setPrepared(cands);
    // Pre-select strong fits so the giver starts from a good default.
    setSelected(new Set(cands.filter((c) => c.matchPct >= 70).map((c) => c.id)));
    setStep("review");
  }

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => prepare({ source: "csv", rows: r.data }),
      error: (e) => setError(e.message),
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function share() {
    const chosen = prepared.filter((c) => selected.has(c.id));
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/share-links/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giverLabel: giverLabel || undefined, candidates: chosen }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not share.");
    setResult(data);
    setStep("done");
  }

  if (notFound) {
    return (
      <Shell>
        <p className="text-center text-sm text-neutral-500">This share link is invalid or has expired.</p>
      </Shell>
    );
  }
  if (!info) return <Shell><p className="text-center text-sm text-neutral-500">Loading…</p></Shell>;

  return (
    <Shell twoCol>
      <MarketingRail />
      <div className="rounded-2xl border border-neutral-200 bg-white/90 p-6 shadow-xl backdrop-blur">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-purple-600">Talent request</div>
        <h1 className="mt-1 text-xl font-bold">{info.title}</h1>
        <p className="text-sm text-neutral-500">
          <span className="font-medium text-neutral-700">{info.askerOrgName}</span> is looking for people who match:
        </p>
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
          {info.criteriaText}
        </p>
      </div>

      {step === "intro" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Share matching profiles from your applicant pool — upload a CSV or connect Airtable /
            Typeform. We rank them against {info.askerOrgName}&apos;s criteria automatically; nothing
            is stored until you choose who to send.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
            <span className="chip">✨ AI-ranked against the ask</span>
            <span className="chip">🔒 You pick who to share</span>
            <span className="chip">No account needed</span>
          </div>
          <button className="btn-primary w-fit" onClick={() => setStep("source")}>
            Share talent →
          </button>
        </div>
      )}

      {step === "source" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            Upload a CSV or connect a source. Nothing is stored until you pick who to send.
          </p>
          {!connectKind ? (
            <>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 hover:border-purple-400">
                <span className="text-2xl">📄</span>
                <span>Drop a CSV of your applicants, or click to choose</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                />
              </label>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setConnectKind("airtable")}>Connect Airtable</button>
                <button className="btn-secondary flex-1" onClick={() => setConnectKind("typeform")}>Connect Typeform</button>
              </div>
            </>
          ) : (
            <ConnectForm kind={connectKind} busy={busy} onCancel={() => setConnectKind(null)} onSubmit={(b) => prepare(b)} />
          )}
          {busy && <p className="text-sm text-neutral-500">✨ Reading and matching against the criteria…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selected.size} selected of {prepared.length}</span>
            <button className="chip" onClick={() => setSelected(new Set(prepared.map((c) => c.id)))}>Select all</button>
            <button className="chip" onClick={() => setSelected(new Set(prepared.filter((c) => c.matchPct >= 70).map((c) => c.id)))}>Top fits</button>
            <button className="chip" onClick={() => setSelected(new Set())}>Clear</button>
          </div>

          <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
            {prepared.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-3">
                <input type="checkbox" className="mt-1" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className="badge-match">{c.matchPct}% match</span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {[c.experienceLevel, c.location].filter(Boolean).join(" · ")}
                  </div>
                  {c.reason && <div className="mt-1 text-xs text-purple-800">✨ {c.reason}</div>}
                </div>
              </label>
            ))}
          </div>

          <input
            className="input"
            placeholder="Your org name (shown as the source) — optional"
            value={giverLabel}
            onChange={(e) => setGiverLabel(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => { setStep("source"); setPrepared([]); }}>Back</button>
            <button className="btn-primary flex-1" disabled={busy || selected.size === 0} onClick={share}>
              {busy ? "Sharing…" : `Share ${selected.size} with ${info.askerOrgName}`}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-2xl">✓</div>
          <h2 className="text-lg font-semibold">Shared {result.shared} with {info.askerOrgName}</h2>
          <p className="text-sm text-neutral-500">
            {result.skippedDuplicates > 0 && `${result.skippedDuplicates} were already in their pool. `}
            They can review and export them now. Thanks!
          </p>
        </div>
      )}
      </div>
    </Shell>
  );
}

function ConnectForm({
  kind,
  busy,
  onCancel,
  onSubmit,
}: {
  kind: "airtable" | "typeform";
  busy: boolean;
  onCancel: () => void;
  onSubmit: (body: object) => void;
}) {
  const [token, setToken] = useState("");
  const [baseId, setBaseId] = useState("");
  const [tableId, setTableId] = useState("");
  const [formId, setFormId] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4">
      <input className="input" placeholder="Access token" value={token} onChange={(e) => setToken(e.target.value)} />
      {kind === "airtable" ? (
        <>
          <input className="input" placeholder="Base ID (app…)" value={baseId} onChange={(e) => setBaseId(e.target.value)} />
          <input className="input" placeholder="Table ID or name" value={tableId} onChange={(e) => setTableId(e.target.value)} />
        </>
      ) : (
        <input className="input" placeholder="Form ID" value={formId} onChange={(e) => setFormId(e.target.value)} />
      )}
      <div className="flex gap-2">
        <button className="btn-secondary" onClick={onCancel}>Back</button>
        <button
          className="btn-primary flex-1"
          disabled={busy}
          onClick={() =>
            onSubmit(kind === "airtable" ? { source: "airtable", token, baseId, tableId } : { source: "typeform", token, formId })
          }
        >
          Pull & match
        </button>
      </div>
    </div>
  );
}

function Shell({ children, twoCol = false }: { children: React.ReactNode; twoCol?: boolean }) {
  if (!twoCol) {
    return (
      <main className="relative min-h-screen px-4 py-12">
        <ContourBackground />
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-4 flex justify-center">
            <Logo size={24} />
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/90 p-6 shadow-xl backdrop-blur">
            {children}
          </div>
          <p className="mt-3 text-center text-xs text-neutral-400">Powered by Refr — talent sharing for orgs</p>
        </div>
      </main>
    );
  }
  return (
    <main className="relative min-h-screen px-4 py-10">
      <ContourBackground />
      <div className="mx-auto grid w-full max-w-5xl items-start gap-8 md:grid-cols-2">
        {children}
      </div>
    </main>
  );
}

// Left marketing rail (like the onboarding intro) shown on the public share page.
function MarketingRail() {
  return (
    <div className="md:sticky md:top-10">
      <Logo size={26} />
      <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight">
        Share talent in a click — <span className="text-purple-700">no spreadsheets</span>.
      </h1>
      <p className="mt-3 text-sm text-neutral-600">
        {TAGLINE_A} {TAGLINE_B}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {VALUE_POINTS.map((v, i) => (
          <div key={v.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            <div>
              <div className="text-sm font-semibold">{v.title}</div>
              <div className="text-xs text-neutral-500">{v.blurb}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white/70 p-3 text-sm backdrop-blur">
        <span className="text-neutral-600">Want your own talent network? </span>
        <Link href="/signup" className="font-semibold text-purple-700 hover:underline">
          Create your org
        </Link>
        <span className="text-neutral-400"> · </span>
        <Link href="/login" className="font-semibold text-purple-700 hover:underline">
          Log in
        </Link>
      </div>
    </div>
  );
}
