"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import ContourBackground from "@/components/ContourBackground";
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
  const [orgType, setOrgType] = useState("");
  const [areas, setAreas] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState(false);

  function toggleArea(a: string) {
    setAreas((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  async function saveDetails() {
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgType: orgType || undefined, focusAreas: [...areas] }),
    });
  }

  function finish() {
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="relative min-h-screen px-4 py-12">
      <ContourBackground />
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
            <p className="text-sm font-semibold text-purple-900">
              {TAGLINE_A} {TAGLINE_B}
            </p>
            <button className="btn-primary w-full" onClick={() => setStep(1)}>Get started</button>
          </div>
        )}

        {/* Step 1 — quick details */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-xl font-semibold">Tell friends who you are</h1>
              <p className="text-sm text-neutral-500">Optional, but it helps orgs decide to connect.</p>
            </div>
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
              <div className="mb-2 text-sm font-medium">What talent do you work with?</div>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((a) => (
                  <button key={a} onClick={() => toggleArea(a)} className={`chip ${areas.has(a) ? "chip-active" : ""}`}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setStep(0)}>Back</button>
              <button
                className="btn-primary flex-1"
                onClick={async () => { await saveDetails(); setStep(2); }}
              >
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
                Pick a source — we&apos;ll read it and map the columns automatically. No spreadsheets to
                wrangle.
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
