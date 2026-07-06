"use client";

import { useEffect, useState } from "react";
import ImportPanel from "@/components/ImportPanel";
import AirtableConnect from "@/components/AirtableConnect";

export default function IntegrationsPage() {
  const [poolSize, setPoolSize] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smart: false }),
    })
      .then((r) => r.json())
      .then((d) => setPoolSize((d.candidates ?? []).filter((c: { isMine: boolean }) => c.isMine).length));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connect your talent sources</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Bring applicants in from wherever they already live. Every profile is analyzed
            automatically on import, and connected sources re-sync weekly.
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
    </div>
  );
}
