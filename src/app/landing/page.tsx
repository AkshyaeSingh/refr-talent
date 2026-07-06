"use client";

import { useState } from "react";
import Logo from "@/components/Logo";
import LandingBackground from "@/components/LandingBackground";
import { ConnectAnimation, SearchAnimation } from "@/components/FeatureAnimation";
import { ONE_LINER, PROBLEM, VALUE_POINTS, TAGLINE_A, TAGLINE_B } from "@/lib/marketing";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen">
      <LandingBackground />

      {/* Header */}
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo size={22} />
        <a href="#waitlist" className="btn-primary">
          Join the waitlist
        </a>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-3xl px-6 pb-16 pt-10 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{ONE_LINER}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-600">{PROBLEM}</p>
        <p className="mt-5 text-lg font-semibold text-purple-900">
          {TAGLINE_A} {TAGLINE_B}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a href="#waitlist" className="btn-primary px-6 py-2.5 text-base">
            Join the waitlist
          </a>
          <a href="#how-it-works" className="btn-secondary px-6 py-2.5 text-base">
            See how it works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-2xl font-bold tracking-tight">How Refr works</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-neutral-500">
          Three steps to move talent faster across the network.
        </p>

        <div className="mt-10 flex flex-col gap-12">
          <FeatureRow
            index={1}
            title={VALUE_POINTS[0].title}
            blurb={VALUE_POINTS[0].blurb}
            graphic={<ConnectAnimation />}
          />
          <FeatureRow
            index={2}
            title={VALUE_POINTS[1].title}
            blurb={VALUE_POINTS[1].blurb}
            graphic={<SearchAnimation />}
            reverse
          />
          <FeatureRow
            index={3}
            title={VALUE_POINTS[2].title}
            blurb={VALUE_POINTS[2].blurb}
            graphic={<ConsentGraphic />}
          />
        </div>
      </section>

      {/* Who it's for */}
      <section className="relative mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-2xl font-bold tracking-tight">Built for the AI-safety talent pipeline</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card">
            <div className="text-lg font-semibold">Fellowships &amp; training programs</div>
            <p className="mt-1.5 text-sm text-neutral-600">
              Give your alumni and applicants ongoing discoverability after the program ends.
            </p>
          </div>
          <div className="card">
            <div className="text-lg font-semibold">Hiring orgs</div>
            <p className="mt-1.5 text-sm text-neutral-600">
              Search across every connected program&apos;s pool with one query, see exactly why each
              candidate fits, and get notified of new talent.
            </p>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="relative mx-auto max-w-xl px-6 py-16">
        <div className="rounded-2xl border border-neutral-200 bg-white/90 p-8 shadow-xl backdrop-blur">
          <h2 className="text-xl font-bold">Request access</h2>
          <p className="mt-1.5 text-sm text-neutral-500">
            Refr is currently invite-only for AI-safety fellowships, training programs, and hiring
            orgs. Tell us about your org and we&apos;ll follow up.
          </p>
          <div className="mt-6">
            <WaitlistForm />
          </div>
        </div>
      </section>

      <footer className="relative mx-auto max-w-5xl px-6 py-8 text-center text-xs text-neutral-400">
        <Logo size={16} showWord={false} />
        <span className="ml-2">© {new Date().getFullYear()} Refr</span>
      </footer>
    </main>
  );
}

function FeatureRow({
  index,
  title,
  blurb,
  graphic,
  reverse,
}: {
  index: number;
  title: string;
  blurb: string;
  graphic: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`grid grid-cols-1 items-center gap-6 sm:grid-cols-2 ${reverse ? "sm:[&>*:first-child]:order-2" : ""}`}>
      <div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
          {index}
        </span>
        <h3 className="mt-3 text-lg font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-neutral-600">{blurb}</p>
      </div>
      <div>{graphic}</div>
    </div>
  );
}

function ConsentGraphic() {
  return (
    <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-purple-50 to-white">
      <div className="flex flex-col items-center gap-3">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="1.6">
          <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-medium text-neutral-500">Only opted-in applicants ever cross an org boundary</span>
      </div>
    </div>
  );
}

function WaitlistForm() {
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"new" | "existing" | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || !email.trim() || !orgName.trim() || !website.trim()) {
      setError("Please fill in your name, email, org name, and org website.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactName, email, orgName, website }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong. Try again.");
    setDone(data.already ? "existing" : "new");
  }

  if (done) {
    return (
      <div className="rounded-xl bg-purple-50 px-4 py-6 text-center">
        <div className="text-2xl">✓</div>
        <p className="mt-2 text-sm font-medium text-purple-900">
          {done === "existing"
            ? "You're already on the list, we'll be in touch soon."
            : "You're on the list, we'll review and follow up shortly."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your name
          <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your email
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@program.org" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Org name
        <input className="input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Your org / program" />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Org website
        <input className="input" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://your-program.org" />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Submitting…" : "Join the waitlist"}
      </button>
    </form>
  );
}
