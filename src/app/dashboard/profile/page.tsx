"use client";

import { useEffect, useState } from "react";

const ORG_TYPES = [
  { value: "fellowship", label: "Fellowship / program" },
  { value: "hiring", label: "Hiring org" },
  { value: "both", label: "Both" },
];

const FOCUS_AREAS = [
  "Research", "Interpretability", "Evals", "Policy",
  "Communications", "Engineering", "Operations", "Field-building",
];

type Org = { id: string; name: string; orgType?: string | null; focusAreas?: string[] };

export default function ProfilePage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [areas, setAreas] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/org").then((r) => r.json()).then((d) => {
      const o: Org = d.org;
      setOrg(o);
      setName(o.name);
      setOrgType(o.orgType ?? "");
      setAreas(new Set(o.focusAreas ?? []));
    });
  }, []);

  function toggleArea(a: string) {
    setAreas((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/org", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, orgType: orgType || undefined, focusAreas: [...areas] }),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!org) return <div className="p-8 text-sm text-neutral-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-bold">Profile</h1>
      <p className="mb-6 text-sm text-neutral-500">
        This is how friend orgs see you. Manage integrations from the Integrations tab.
      </p>

      {/* Org details */}
      <section className="card flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Org details</h2>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Type
          <div className="flex flex-wrap gap-2">
            {ORG_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setOrgType(t.value)}
                className={`chip ${orgType === t.value ? "chip-active" : ""}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 text-sm font-medium">
          Focus areas
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((a) => (
              <button key={a} onClick={() => toggleArea(a)} className={`chip ${areas.has(a) ? "chip-active" : ""}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-primary w-fit" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="text-sm text-purple-700">Saved.</span>}
        </div>
      </section>
    </div>
  );
}
