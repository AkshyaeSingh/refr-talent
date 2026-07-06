"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type Event = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
};

type Candidate = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string | null;
  location?: string | null;
  remoteOk: boolean;
  linkedinUrl?: string | null;
  resumeUrl?: string | null;
  notes?: string | null;
  rawFields?: Record<string, string> | null;
  headline?: string | null;
  summary?: string | null;
  topics?: string[];
  credentials?: string[];
  audienceTier?: string | null;
  links?: Record<string, string> | null;
  enrichedFields?: string[];
  consentToShare?: boolean;
  createdAt: string;
  org: { id: string; name: string; slug?: string };
  originOrg?: { name: string } | null;
  events: Event[];
};

const MOCK_ORG_SLUG = "mock-talent-org-demo";

type JourneyStep = { label: string; detail?: string | null };

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [mergedFrom, setMergedFrom] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [journey, setJourney] = useState<{ steps: JourneyStep[]; narrative: string } | null>(null);
  const [journeyBusy, setJourneyBusy] = useState(false);
  const [journeyErr, setJourneyErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/candidates/${id}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) setError(data.error ?? "Not found.");
        else {
          setCandidate(data.candidate);
          setMergedFrom(data.mergedFrom ?? 0);
          setSources(data.sources ?? []);
        }
      });
  }, [id]);

  async function mapJourney() {
    setJourneyBusy(true);
    setJourneyErr(null);
    const res = await fetch(`/api/candidates/${id}/journey`, { method: "POST" });
    const data = await res.json();
    setJourneyBusy(false);
    if (!res.ok) return setJourneyErr(data.error ?? "Couldn't map a journey.");
    setJourney(data);
  }

  if (error) return <div className="p-8 text-sm text-red-600">{error}</div>;
  if (!candidate) return <div className="p-8 text-sm text-neutral-500">Loading…</div>;

  const answers = candidate.rawFields ?? {};

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/dashboard" className="btn-ghost mb-4 inline-block">
        ← Back to search
      </Link>

      {candidate.org.slug === MOCK_ORG_SLUG && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <span className="font-semibold">Sample profile.</span> This is a fake profile from the Mock
          Talent Org, here so you can explore how Refr works. Connect your own pool to see real candidates.
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{candidate.name}</h1>
        <p className="text-sm text-neutral-500">
          {[candidate.experienceLevel, candidate.location, candidate.remoteOk ? "remote ok" : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          In {candidate.org.name}&apos;s pool
          {candidate.originOrg ? ` · originally from ${candidate.originOrg.name}` : ""}
          {mergedFrom > 0 && ` · merged from ${mergedFrom + 1} records`}
        </p>
        {sources.length > 1 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {sources.map((s) => (
              <span key={s} className="badge">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* AI-extracted signal profile */}
      {(candidate.headline || (candidate.credentials?.length ?? 0) > 0 || candidate.summary) && (
        <section className="card mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Profile</h2>
            <span className="text-[11px] text-neutral-400">✨ AI-summarized from application</span>
          </div>
          {candidate.headline && <p className="text-sm font-medium">{candidate.headline}</p>}
          {candidate.summary && <p className="mt-1 text-sm text-neutral-600">{candidate.summary}</p>}
          {(candidate.credentials?.length ?? 0) > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-neutral-500">Credentials & signals</div>
              <div className="flex flex-wrap gap-1.5">
                {candidate.credentials!.map((c) => (
                  <span key={c} className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(candidate.topics?.length ?? 0) > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-neutral-500">Topics</div>
              <div className="flex flex-wrap gap-1">
                {candidate.topics!.map((t) => <span key={t} className="badge">{t}</span>)}
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            {candidate.audienceTier && <span>👥 {candidate.audienceTier}</span>}
            {candidate.links &&
              Object.entries(candidate.links).map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline">
                  {k}
                </a>
              ))}
            {candidate.consentToShare === false && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                ⚠ Not shareable (no consent)
              </span>
            )}
          </div>
        </section>
      )}

      {/* Talent journey */}
      <section className="card mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Talent journey</h2>
          {!journey && (
            <button className="btn-secondary" onClick={mapJourney} disabled={journeyBusy}>
              {journeyBusy ? "Mapping…" : "✨ Map journey"}
            </button>
          )}
        </div>
        {journeyErr && <p className="text-sm text-red-600">{journeyErr}</p>}
        {!journey && !journeyErr && !journeyBusy && (
          <p className="text-sm text-neutral-400">
            Build a pipeline of where this person has been — from their application answers.
          </p>
        )}
        {journey && (
          <>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
              {journey.steps.map((s, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="inline-flex flex-col rounded-lg bg-purple-50 px-2.5 py-1">
                    <span className="text-sm font-medium text-purple-900">{s.label}</span>
                    {s.detail && <span className="text-[11px] text-purple-700">{s.detail}</span>}
                  </span>
                  {i < journey.steps.length - 1 && <span className="text-neutral-400">→</span>}
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-neutral-600">{journey.narrative}</p>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2 flex flex-col gap-6">
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Profile</h2>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Detail label="Email" value={candidate.email} />
              <Detail label="Phone" value={candidate.phone} />
              <Detail label="LinkedIn" value={candidate.linkedinUrl} link />
              <Detail label="Resume" value={candidate.resumeUrl} link />
            </dl>
            {candidate.skills.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-neutral-500">Skills</div>
                <div className="flex flex-wrap gap-1">
                  {candidate.skills.map((s) => (
                    <span key={s} className="badge">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {candidate.roleInterest.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-neutral-500">Role interest</div>
                <div className="flex flex-wrap gap-1">
                  {candidate.roleInterest.map((r) => (
                    <span key={r} className="badge">{r}</span>
                  ))}
                </div>
              </div>
            )}
            {candidate.notes && (
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-neutral-500">Notes</div>
                <p className="text-sm text-neutral-700">{candidate.notes}</p>
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">Application answers</h2>
            {Object.keys(answers).length === 0 ? (
              <p className="text-sm text-neutral-400">No raw answers stored.</p>
            ) : (
              <dl className="flex flex-col gap-2 text-sm">
                {Object.entries(answers).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-3 gap-2 border-b border-neutral-100 pb-2 last:border-0">
                    <dt className="col-span-1 font-medium text-neutral-500">{k}</dt>
                    <dd className="col-span-2 whitespace-pre-wrap text-neutral-800">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>

        <aside>
          <section className="card">
            <h2 className="mb-3 text-sm font-semibold">History</h2>
            <ol className="flex flex-col gap-3">
              {candidate.events.map((e) => (
                <li key={e.id} className="flex gap-2 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                  <div>
                    <div className="text-neutral-800">{e.description}</div>
                    <div className="text-xs text-neutral-400">
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
              {candidate.events.length === 0 && (
                <li className="text-sm text-neutral-400">No history recorded.</li>
              )}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value, link }: { label: string; value?: string | null; link?: boolean }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="truncate text-neutral-800">
        {value ? (
          link ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-purple-700 hover:underline">
              link
            </a>
          ) : (
            value
          )
        ) : (
          "—"
        )}
      </dd>
    </>
  );
}
