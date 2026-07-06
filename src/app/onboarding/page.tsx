"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import FlickerBackground from "@/components/FlickerBackground";
import ImportPanel from "@/components/ImportPanel";
import { ONE_LINER, PROBLEM, VALUE_POINTS, TAGLINE_A, TAGLINE_B } from "@/lib/marketing";

const ORG_TYPES = [
  { value: "fellowship", label: "Fellowship / program", blurb: "You run cohorts and want your alumni discovered." },
  { value: "hiring", label: "Hiring org", blurb: "You're sourcing candidates from partner pools." },
  { value: "both", label: "Both", blurb: "You run programs and hire." },
];

const FOCUS_AREAS = [
  "Research", "Interpretability", "Evals", "Policy",
  "Communications", "Engineering", "Operations", "Field-building",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  // Profile fields — pre-filled from signup (org name, website) and from the
  // AI website read that already ran during account creation; all editable.
  const [website, setWebsite] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orgType, setOrgType] = useState("");
  const [areas, setAreas] = useState<Set<string>>(new Set());
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [imported, setImported] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Load whatever's already on the org (filled at signup) so this step opens
  // pre-populated instead of asking the user to redo work.
  useEffect(() => {
    fetch("/api/org")
      .then((r) => r.json())
      .then((data) => {
        const o = data.org as {
          name?: string;
          website?: string | null;
          description?: string | null;
          orgType?: string | null;
          focusAreas?: string[];
          logoUrl?: string | null;
        } | undefined;
        if (o) {
          if (o.name) setName(o.name);
          if (o.website) setWebsite(o.website);
          if (o.description) setDescription(o.description);
          if (o.orgType) setOrgType(o.orgType);
          if (o.focusAreas?.length) setAreas(new Set(o.focusAreas));
          if (o.logoUrl) setLogoUrl(o.logoUrl);
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  function toggleArea(a: string) {
    setAreas((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  // Secondary action — only needed if they change the website and want fresh
  // suggestions; the initial fill already happened automatically at signup.
  async function reFetch() {
    if (!website.trim()) return setEnrichMsg("Add your website link first.");
    setEnriching(true);
    setEnrichMsg("✨ Reading your site and filling in what we can…");
    try {
      const res = await fetch("/api/org/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEnrichMsg(data.error ?? "Couldn't read that site — fill the details in below.");
      } else {
        const d = data.derived as {
          name: string | null;
          description: string | null;
          orgType: string | null;
          focusAreas: string[];
        };
        if (d.description) setDescription(d.description);
        if (d.orgType) setOrgType(d.orgType);
        if (d.focusAreas?.length) setAreas(new Set(d.focusAreas.map((a) => a.trim()).filter(Boolean)));
        setEnrichMsg("✓ Updated from your site. Review and edit anything below.");
      }
    } catch {
      setEnrichMsg("Something went wrong — fill the details in below.");
    }
    setEnriching(false);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      setEnrichMsg("That logo is a bit large — please use an image under 400KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function saveDetails() {
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim() || undefined,
        orgType: orgType || undefined,
        focusAreas: [...areas],
        website: website.trim() || undefined,
        description: description.trim() || undefined,
        logoUrl: logoUrl || undefined,
      }),
    });
  }

  function finish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen px-4 py-12">
      <FlickerBackground />
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white/90 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex items-center justify-between">
          <Logo size={24} />
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-purple-600" : "bg-neutral-200"}`} />
            ))}
          </div>
        </div>

        {/* Step 0 — what Refr is */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold leading-snug">{ONE_LINER}</h1>
            <p className="text-sm leading-6 text-neutral-600">{PROBLEM}</p>
            <div className="flex flex-col gap-2">
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
            <p className="text-sm font-semibold text-purple-900">{TAGLINE_A} {TAGLINE_B}</p>
            <button className="btn-primary w-full" onClick={() => setStep(1)}>Get started</button>
          </div>
        )}

        {/* Step 1 — profile: pre-filled from signup + website read, editable */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-semibold">Review your org profile</h1>
              <p className="text-sm text-neutral-500">
                {profileLoading
                  ? "Loading what we already filled in…"
                  : "We filled this in from your website — review and edit anything."}
              </p>
            </div>

            {/* Website + optional re-fetch */}
            <div>
              <div className="mb-2 text-sm font-medium">Website or program link</div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://your-program.org"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); reFetch(); } }}
                />
                <button className="btn-secondary whitespace-nowrap" disabled={enriching} onClick={reFetch}>
                  {enriching ? "Reading…" : "↻ Re-fetch"}
                </button>
              </div>
              {enrichMsg && <p className="mt-1.5 text-xs text-purple-700">{enrichMsg}</p>}
            </div>

            {/* Logo + name */}
            <div className="flex items-center gap-4">
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
              <button
                onClick={() => logoRef.current?.click()}
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-xs text-neutral-400 transition-colors hover:border-purple-400"
                title="Upload your logo"
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="logo" className="h-full w-full object-cover" />
                ) : (
                  "Add logo"
                )}
              </button>
              <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
                Org name
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your org / program" />
              </label>
            </div>

            {/* Description */}
            <label className="flex flex-col gap-1 text-sm font-medium">
              One-line description
              <textarea
                className="input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What your org does and who it serves."
              />
            </label>

            <div>
              <div className="mb-2 text-sm font-medium">What kind of org are you?</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ORG_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setOrgType(t.value)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      orgType === t.value ? "border-purple-500 bg-purple-50" : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="mt-0.5 text-xs text-neutral-500">{t.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">What talent are you looking to source or make discoverable?</div>
              <div className="flex flex-wrap gap-2">
                {[...new Set([...FOCUS_AREAS, ...areas])].map((a) => (
                  <button key={a} onClick={() => toggleArea(a)} className={`chip ${areas.has(a) ? "chip-active" : ""}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button className="btn-primary flex-1" onClick={async () => { await saveDetails(); setStep(2); }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — bring the pool in */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-semibold">Bring your talent pool in</h1>
              <p className="text-sm text-neutral-500">
                Pick a source — we&apos;ll read it and map the columns automatically. No spreadsheets to wrangle.
              </p>
            </div>
            <ImportPanel showSources={false} onImported={() => setImported(true)} />
            {imported && (
              <p className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-800">
                ✓ Your pool is in. You can add more sources anytime from Integrations.
              </p>
            )}
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary flex-1" onClick={finish}>
                {imported ? "Go to Refr" : "Skip for now"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
