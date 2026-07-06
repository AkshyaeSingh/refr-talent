"use client";

import { useEffect, useState, useCallback } from "react";

type Link = {
  id: string;
  token: string;
  title: string;
  criteriaText: string;
  status: string;
  receivedCount: number;
  createdAt: string;
};

export default function QuickShare() {
  const [links, setLinks] = useState<Link[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/share-links");
    if (res.ok) setLinks((await res.json()).links ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount
    load();
  }, [load]);

  async function create() {
    if (!title.trim() || !criteria.trim()) return;
    setBusy(true);
    await fetch("/api/share-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, criteriaText: criteria }),
    });
    setBusy(false);
    setTitle("");
    setCriteria("");
    setOpen(false);
    load();
  }

  function shareUrl(token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/share/${token}`;
  }

  async function copy(token: string) {
    await navigator.clipboard.writeText(shareUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Quick share requests</h2>
          <p className="text-xs text-neutral-500">
            Ask any org for talent without them joining — send a link, they pick matches, they land in your pool.
          </p>
        </div>
        <button className="btn-secondary whitespace-nowrap" onClick={() => setOpen(true)}>
          ＋ New request link
        </button>
      </div>

      {links.length > 0 && (
        <div className="card flex flex-col divide-y divide-neutral-100">
          {links.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {l.title}
                  <span className={`badge ${l.status === "RECEIVED" ? "badge-match" : ""}`}>
                    {l.status === "RECEIVED" ? `received ${l.receivedCount}` : "open"}
                  </span>
                </div>
                <div className="truncate text-xs text-neutral-400">{shareUrl(l.token)}</div>
              </div>
              <button className="btn-secondary whitespace-nowrap" onClick={() => copy(l.token)}>
                {copied === l.token ? "Copied!" : "Copy link"}
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-6" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold">New quick-share request</h3>
            <p className="mb-4 text-sm text-neutral-500">
              Describe who you&apos;re looking for. The giver&apos;s applicants get ranked against this automatically.
            </p>
            <div className="flex flex-col gap-3">
              <input className="input" placeholder="Title (e.g. MATS Winter — interpretability stream)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea
                className="input min-h-[140px]"
                placeholder="Paste your criteria — a role spec, a persona, a list of must-haves and bonuses…"
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={busy || !title.trim() || !criteria.trim()} onClick={create}>
                {busy ? "Creating…" : "Create link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
