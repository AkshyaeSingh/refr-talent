"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

// Floating help button (bottom-right) that opens a small feedback box. Sends to
// /api/feedback, which stores it and emails the operator instantly.
export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, path: pathname }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error ?? "Couldn't send. Try again.");
    }
    setSent(true);
    setMessage("");
  }

  function close() {
    setOpen(false);
    setSent(false);
    setError(null);
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-80 rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl">
          {sent ? (
            <div className="py-4 text-center">
              <div className="text-2xl">✓</div>
              <p className="mt-1 text-sm font-medium text-purple-900">Thanks — we got it.</p>
              <button className="btn-ghost mt-2 text-xs" onClick={close}>Close</button>
            </div>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Feedback &amp; help</h3>
                <button className="btn-ghost px-1 text-neutral-400" onClick={close}>✕</button>
              </div>
              <p className="mb-2 text-xs text-neutral-500">
                Something broken or confusing? Tell us what&apos;s up — it goes straight to the team.
              </p>
              <textarea
                autoFocus
                rows={4}
                className="input w-full resize-none text-sm"
                placeholder="What's not working, or what would help?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              <button className="btn-primary mt-2 w-full" disabled={busy || !message.trim()} onClick={submit}>
                {busy ? "Sending…" : "Send"}
              </button>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="Help and feedback"
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition-colors hover:bg-purple-700"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        )}
      </button>
    </>
  );
}
