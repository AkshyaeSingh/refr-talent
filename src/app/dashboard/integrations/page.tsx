"use client";

import { useEffect, useState } from "react";
import ImportPanel from "@/components/ImportPanel";
import AirtableConnect from "@/components/AirtableConnect";

export default function IntegrationsPage() {
  const [poolSize, setPoolSize] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smart: false }),
    })
      .then((r) => r.json())
      .then((d) => setPoolSize((d.candidates ?? []).filter((c: { isMine: boolean }) => c.isMine).length));
  }, []);

  async function analyze(all: boolean) {
    setAnalyzing(true);
    setAnalyzeMsg("✨ Analyzing profiles (credentials, topics, links, consent)…");
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all }),
    });
    const d = await res.json();
    setAnalyzing(false);
    setAnalyzeMsg(res.ok ? `Analyzed ${d.enriched} profiles. ${d.remaining} left unanalyzed.` : d.error);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connect your talent sources</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bring applicants in from wherever they already live. Connected sources keep your pool
            up to date automatically — pick one to get started.
          </p>
        </div>
        {poolSize !== null && (
          <span className="whitespace-nowrap text-xs text-neutral-500">{poolSize} candidates in your pool</span>
        )}
      </div>

      {/* Airtable "finish setup" surface — only appears mid-connection */}
      <div className="mb-4 empty:hidden">
        <AirtableConnect onImported={() => window.location.reload()} />
      </div>

      <ImportPanel />

      <section className="card mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Analyze profiles</h2>
          <p className="text-xs text-neutral-500">
            Build AI profiles for your pool — credentials (MATS, BlueDot, EA club…), topics, links,
            and consent — so search and highlights work well. Runs automatically after each import.
          </p>
          {analyzeMsg && <p className="mt-1 text-xs text-purple-700">{analyzeMsg}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button className="btn-primary whitespace-nowrap" disabled={analyzing} onClick={() => analyze(false)}>
            {analyzing ? "Analyzing…" : "Analyze new"}
          </button>
          <button className="btn-ghost whitespace-nowrap text-xs" disabled={analyzing} onClick={() => analyze(true)}>
            Re-analyze all
          </button>
        </div>
      </section>

      <section className="card mt-6 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Export your pool</h2>
          <p className="text-xs text-neutral-500">
            Download everything (including candidates pulled from friends) as a CSV — ready to load
            back into Airtable or a sheet.
          </p>
        </div>
        <a href="/api/export" className="btn-secondary whitespace-nowrap">
          Export CSV
        </a>
      </section>
    </div>
  );
}
