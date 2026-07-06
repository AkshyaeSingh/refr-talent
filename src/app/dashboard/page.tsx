"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EMPTY_CRITERIA, isCriteriaEmpty, type Criteria } from "@/lib/criteria";

type Candidate = {
  id: string;
  name: string;
  email?: string | null;
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string | null;
  location?: string | null;
  remoteOk: boolean;
  credentials?: string[];
  topics?: string[];
  audienceTier?: string | null;
  headline?: string | null;
  summary?: string | null;
  cos?: number;
  org: { id: string; name: string };
  originOrg?: { name: string } | null;
  score: number;
  matchPct: number | null;
  isMine: boolean;
};

type FriendOrg = { id: string; name: string; shareMode: string };

// Facet dimensions used to re-narrow results client-side (no refetch).
type FacetKey = "credential" | "topic" | "location" | "source" | "audience";
const FACET_LABELS: Record<FacetKey, string> = {
  credential: "Credentials",
  topic: "Topics",
  location: "Location",
  source: "Source",
  audience: "Audience",
};

function candidateFacetValues(c: Candidate): Record<FacetKey, string[]> {
  return {
    credential: c.credentials ?? [],
    topic: c.topics ?? [],
    location: c.location ? [c.location] : [],
    source: [c.isMine ? "My pool" : c.org.name],
    audience: c.audienceTier ? [c.audienceTier] : [],
  };
}

const EXAMPLES = [
  "Senior interpretability researchers",
  "Policy people in DC",
  "Remote-friendly engineers",
  "Berkeley",
];

function commaList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// Category colouring for credential pills (mirrors the results legend).
const PROGRAM_CREDS = new Set([
  "MATS", "ARENA", "SPAR", "MARS", "LASR Labs", "BlueDot / AISF", "EA university group",
]);
const ORG_CREDS = new Set(["AI safety org"]);
function credentialClass(cred: string): string {
  if (PROGRAM_CREDS.has(cred)) return "border border-orange-200 bg-orange-50 text-orange-800";
  if (ORG_CREDS.has(cred)) return "border border-purple-200 bg-purple-50 text-purple-800";
  return "border border-emerald-200 bg-emerald-50 text-emerald-800"; // degree / output
}

function SearchWorkspace() {
  const params = useSearchParams();
  const savedId = params.get("s");

  const [friends, setFriends] = useState<FriendOrg[]>([]);
  const [myOrgId, setMyOrgId] = useState("");
  // Pools included in the search. "me" = own pool.
  const [pools, setPools] = useState<Set<string>>(new Set(["me"]));
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [criteria, setCriteria] = useState<Criteria>(EMPTY_CRITERIA);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState("");
  const [explain, setExplain] = useState(false);
  const [aiInfo, setAiInfo] = useState<{ criteria: Criteria; keywords: string[] } | null>(null);
  const [aiDoc, setAiDoc] = useState<{
    required: string[];
    preferred: string[];
    domains: string[];
  } | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [facets, setFacets] = useState<Record<FacetKey, Set<string>>>({
    credential: new Set(),
    topic: new Set(),
    location: new Set(),
    source: new Set(),
    audience: new Set(),
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  const criteriaActive = !isCriteriaEmpty(criteria);
  const criteriaCount =
    criteria.skills.length +
    criteria.roleInterest.length +
    (criteria.experienceLevel ? 1 : 0) +
    (criteria.location ? 1 : 0) +
    (criteria.remoteOk ? 1 : 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPoolPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const resolveTargets = useCallback(
    (poolSet: Set<string>, meId: string) =>
      [...poolSet].map((p) => (p === "me" ? meId : p)).filter(Boolean),
    []
  );

  const runSearch = useCallback(
    async (opts?: { pools?: Set<string>; query?: string; criteria?: Criteria }) => {
      const activePools = opts?.pools ?? pools;
      setLoading(true);
      setStatus(null);
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetOrgIds: resolveTargets(activePools, myOrgId || "me-placeholder").filter(
            (t) => t !== "me-placeholder"
          ),
          query: opts?.query ?? query,
          criteria: opts?.criteria ?? criteria,
          explain,
        }),
      });
      const data = await res.json();
      setLoading(false);
      setRan(true);
      setSelected(new Set());
      if (!res.ok) {
        setStatus(data.error ?? "Search failed.");
        setCandidates([]);
        return;
      }
      setCandidates(data.candidates ?? []);
      setFacets({
        credential: new Set(),
        topic: new Set(),
        location: new Set(),
        source: new Set(),
        audience: new Set(),
      });
      setAiInfo(data.ai ?? null);
      setAiDoc(data.aiDoc ?? null);
      setAiOn(Boolean(data.aiAvailable));
      setReasons(data.reasons ?? {});
      if (data.myOrgId) setMyOrgId(data.myOrgId);
    },
    [pools, query, criteria, myOrgId, resolveTargets, explain]
  );

  // Load friend orgs (approved connections) for pool chips + share targets.
  useEffect(() => {
    fetch("/api/connections")
      .then((r) => r.json())
      .then((data) => {
        const myId = data.myOrgId ?? "";
        setMyOrgId(myId);
        const approved: FriendOrg[] = (data.connections ?? [])
          .filter((c: { status: string }) => c.status === "APPROVED")
          .map((c: { orgA: { id: string; name: string }; orgB: { id: string; name: string }; shareMode: string }) => {
            const other = c.orgA.id === myId ? c.orgB : c.orgA;
            return { id: other.id, name: other.name, shareMode: c.shareMode };
          });
        setFriends(approved);
      });
  }, []);

  // Load a saved search when arriving via ?s=<id>.
  useEffect(() => {
    if (!savedId) return;
    fetch("/api/searches")
      .then((r) => r.json())
      .then((data) => {
        const s = (data.searches ?? []).find((x: { id: string }) => x.id === savedId);
        if (!s) return;
        const raw = (s.criteria ?? {}) as Criteria & { _pools?: string[] };
        const { _pools, ...crit } = raw;
        const c: Criteria = { ...EMPTY_CRITERIA, ...crit };
        const p = new Set<string>(_pools && _pools.length > 0 ? _pools : ["me"]);
        setPools(p);
        setQuery(s.query ?? "");
        setCriteria(c);
        runSearch({ pools: p, query: s.query ?? "", criteria: c });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId]);

  function togglePool(id: string) {
    setPools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add("me");
      return next;
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

  // Facet values + counts, computed from the current result set so filters
  // always reflect real data. Ordered by frequency.
  const availableFacets = useMemo(() => {
    const out: Record<FacetKey, { value: string; count: number }[]> = {
      credential: [], topic: [], location: [], source: [], audience: [],
    };
    const counts: Record<FacetKey, Map<string, number>> = {
      credential: new Map(), topic: new Map(), location: new Map(), source: new Map(), audience: new Map(),
    };
    for (const c of candidates) {
      const vals = candidateFacetValues(c);
      (Object.keys(counts) as FacetKey[]).forEach((k) => {
        for (const v of vals[k]) counts[k].set(v, (counts[k].get(v) ?? 0) + 1);
      });
    }
    (Object.keys(out) as FacetKey[]).forEach((k) => {
      out[k] = [...counts[k].entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    });
    return out;
  }, [candidates]);

  const activeFacetCount = useMemo(
    () => (Object.values(facets) as Set<string>[]).reduce((n, s) => n + s.size, 0),
    [facets]
  );

  // A candidate passes if, for every facet with selections, it matches at least
  // one selected value (OR within a facet, AND across facets).
  const visibleCandidates = useMemo(() => {
    if (activeFacetCount === 0) return candidates;
    return candidates.filter((c) => {
      const vals = candidateFacetValues(c);
      return (Object.keys(facets) as FacetKey[]).every((k) => {
        const sel = facets[k];
        if (sel.size === 0) return true;
        return vals[k].some((v) => sel.has(v));
      });
    });
  }, [candidates, facets, activeFacetCount]);

  function toggleFacet(key: FacetKey, value: string) {
    setFacets((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(value)) next[key].delete(value);
      else next[key].add(value);
      return next;
    });
  }

  const ownResults = useMemo(() => candidates.filter((c) => c.isMine), [candidates]);
  const ownSelected = useMemo(
    () => [...selected].filter((id) => candidates.find((c) => c.id === id)?.isMine),
    [selected, candidates]
  );
  const foreignSelected = useMemo(() => {
    const byOrg = new Map<string, string[]>();
    for (const id of selected) {
      const c = candidates.find((x) => x.id === id);
      if (c && !c.isMine) {
        byOrg.set(c.org.id, [...(byOrg.get(c.org.id) ?? []), id]);
      }
    }
    return byOrg;
  }, [selected, candidates]);

  const topFitIds = useMemo(
    () => ownResults.filter((c) => c.score > 0).map((c) => c.id),
    [ownResults]
  );

  const targetMode = friends.find((f) => f.id === shareTarget)?.shareMode ?? "MANUAL";

  async function saveSearch() {
    const name = window.prompt("Name this search (shows under History):");
    if (!name) return;
    await fetch("/api/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        query,
        criteria: { ...criteria, _pools: [...pools] },
      }),
    });
    window.dispatchEvent(new Event("history-updated"));
    setStatus(`Saved “${name}” to History.`);
  }

  async function share(mode: "all" | "top" | "manual") {
    if (!shareTarget) return setStatus("Pick a friend org to share with.");
    let ids: string[];
    if (mode === "all") ids = ownResults.map((c) => c.id);
    else if (mode === "top") ids = topFitIds;
    else ids = ownSelected;
    if (ids.length === 0) return setStatus("Nothing to share for that option.");

    setStatus("Sharing…");
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PUSH",
        otherOrgId: shareTarget,
        candidateIds: ids,
        filterCriteria: criteriaActive ? criteria : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setStatus(data.error ?? "Share failed.");
    setStatus(
      `Shared ${data.copied} candidate(s)${
        data.skippedAlreadyCopied ? `, ${data.skippedAlreadyCopied} already there` : ""
      }.`
    );
    setSelected(new Set());
  }

  async function pull() {
    if (foreignSelected.size === 0) return;
    setStatus("Pulling…");
    let copied = 0;
    let skipped = 0;
    for (const [orgId, ids] of foreignSelected) {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PULL", otherOrgId: orgId, candidateIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) return setStatus(data.error ?? "Pull failed.");
      copied += data.copied;
      skipped += data.skippedAlreadyCopied;
    }
    setStatus(`Pulled ${copied} into your pool${skipped ? `, ${skipped} already there` : ""}.`);
    setSelected(new Set());
  }

  const foreignSelectedCount = [...foreignSelected.values()].reduce((a, v) => a + v.length, 0);
  const availableToAdd = friends.filter((f) => !pools.has(f.id));
  const centered = !ran;

  return (
    <div className={`mx-auto max-w-3xl px-6 ${centered ? "flex min-h-[70vh] flex-col justify-center" : "py-8"}`}>
      <h1 className={`text-center font-bold tracking-tight ${centered ? "mb-8 text-4xl" : "mb-6 text-2xl"}`}>
        Who are you looking for?
      </h1>

      {/* Search box */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        {/* Pool chips */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative" ref={pickerRef}>
            <button
              className="chip"
              onClick={() => setPoolPickerOpen((v) => !v)}
              title="Add a friend's pool to this search"
            >
              ＋
            </button>
            {poolPickerOpen && (
              <div className="absolute left-0 top-8 z-20 w-56 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                {availableToAdd.length === 0 && (
                  <p className="px-3 py-2 text-xs text-neutral-400">
                    {friends.length === 0
                      ? "Add friends to search their pools."
                      : "All friend pools already included."}
                  </p>
                )}
                {availableToAdd.map((f) => (
                  <button
                    key={f.id}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-50"
                    onClick={() => {
                      togglePool(f.id);
                      setPoolPickerOpen(false);
                    }}
                  >
                    {f.name}&apos;s pool
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`chip ${pools.has("me") ? "chip-active" : ""}`}
            onClick={() => togglePool("me")}
          >
            My pool {pools.has("me") && <span className="text-purple-600">×</span>}
          </button>
          {friends
            .filter((f) => pools.has(f.id))
            .map((f) => (
              <button key={f.id} className="chip chip-active" onClick={() => togglePool(f.id)}>
                {f.name} <span className="text-purple-600">×</span>
              </button>
            ))}
        </div>

        <textarea
          rows={2}
          className="w-full resize-none border-0 bg-transparent text-base outline-none placeholder:text-neutral-400"
          placeholder="Try: senior interpretability researchers in Berkeley, open to remote"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              runSearch();
            }
          }}
        />

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className={`chip ${criteriaActive ? "chip-active" : ""}`}
              onClick={() => setCriteriaOpen(true)}
            >
              <FilterIcon /> Criteria{criteriaActive ? ` · ${criteriaCount}` : ""}
            </button>
            <button
              className={`chip ${explain ? "chip-active" : ""}`}
              onClick={() => setExplain((v) => !v)}
              title="Add a one-line AI note on why each top result fits"
            >
              ✨ Explain matches
            </button>
          </div>
          <button
            onClick={() => runSearch()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
            title="Search"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Example chips */}
      {centered && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="chip"
              onClick={() => {
                setQuery(ex);
                runSearch({ query: ex });
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Post-search action bar */}
      {ran && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={saveSearch}>
            Save to History
          </button>

          {ownResults.length > 0 && friends.length > 0 && (
            <>
              <select
                className="input"
                value={shareTarget}
                onChange={(e) => setShareTarget(e.target.value)}
              >
                <option value="">Share with…</option>
                {friends.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button
                className={`btn-secondary ${shareTarget && targetMode === "ALL" ? "ring-2 ring-purple-200" : ""}`}
                onClick={() => share("all")}
                disabled={!shareTarget}
                title={targetMode === "ALL" ? "This friend prefers full-list sharing" : ""}
              >
                Share all
              </button>
              <button
                className={`btn-secondary ${shareTarget && targetMode === "TOP_FITS" ? "ring-2 ring-purple-200" : ""}`}
                onClick={() => share("top")}
                disabled={!shareTarget || !criteriaActive}
                title={!criteriaActive ? "Add criteria to rank top fits" : ""}
              >
                Share top fits
              </button>
              <button
                className="btn-secondary"
                onClick={() => share("manual")}
                disabled={!shareTarget || ownSelected.length === 0}
              >
                Share selected ({ownSelected.length})
              </button>
            </>
          )}

          {foreignSelectedCount > 0 && (
            <button className="btn-primary" onClick={pull}>
              Pull selected ({foreignSelectedCount})
            </button>
          )}
        </div>
      )}

      {status && <p className="mt-3 text-sm text-purple-700">{status}</p>}

      {/* Criteria-doc breakdown (long paste → weighted signals) */}
      {ran && aiDoc && (
        <div className="mt-3 flex flex-col gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs">
          <span className="font-medium text-neutral-600">✨ Broke your criteria into:</span>
          {aiDoc.required.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-neutral-400">Required</span>
              {aiDoc.required.map((s) => <span key={`rq-${s}`} className="badge-match">{s}</span>)}
            </div>
          )}
          {aiDoc.preferred.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-neutral-400">Bonus</span>
              {aiDoc.preferred.map((s) => <span key={`pf-${s}`} className="badge">{s}</span>)}
            </div>
          )}
          {aiDoc.domains.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-16 shrink-0 text-neutral-400">Domain</span>
              {aiDoc.domains.map((s) => <span key={`dm-${s}`} className="badge">{s}</span>)}
            </div>
          )}
        </div>
      )}

      {/* What the AI extracted from the query */}
      {ran && aiInfo && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span className="font-medium">✨ Understood:</span>
          {aiInfo.criteria.skills.map((s) => (
            <span key={`ais-${s}`} className="badge-match">
              {s}
            </span>
          ))}
          {aiInfo.criteria.roleInterest.map((r) => (
            <span key={`air-${r}`} className="badge-match">
              {r}
            </span>
          ))}
          {aiInfo.criteria.experienceLevel && <span className="badge">{aiInfo.criteria.experienceLevel}</span>}
          {aiInfo.criteria.location && <span className="badge">{aiInfo.criteria.location}</span>}
          {aiInfo.criteria.remoteOk && <span className="badge">remote ok</span>}
          {aiInfo.keywords.map((k) => (
            <span key={`aik-${k}`} className="badge">
              “{k}”
            </span>
          ))}
        </div>
      )}
      {ran && !aiOn && (
        <p className="mt-3 text-xs text-neutral-400">
          Smart search is off — set <code>ANTHROPIC_API_KEY</code> to enable natural-language
          queries and match explanations. Using keyword search.
        </p>
      )}

      {/* Facet filters */}
      {ran && candidates.length > 0 && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600">
              Filters{activeFacetCount > 0 ? ` · ${activeFacetCount}` : ""}
            </span>
            {activeFacetCount > 0 && (
              <button
                className="btn-ghost text-xs"
                onClick={() =>
                  setFacets({ credential: new Set(), topic: new Set(), location: new Set(), source: new Set(), audience: new Set() })
                }
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {(Object.keys(FACET_LABELS) as FacetKey[])
              .filter((k) => availableFacets[k].length > 0)
              .map((k) => (
                <div key={k} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                    {FACET_LABELS[k]}
                  </span>
                  {availableFacets[k].slice(0, 12).map(({ value, count }) => (
                    <button
                      key={value}
                      className={`chip ${facets[k].has(value) ? "chip-active" : ""}`}
                      onClick={() => toggleFacet(k, value)}
                    >
                      {value} <span className="text-neutral-400">{count}</span>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Results */}
      {ran && (
        <div className="mt-5 flex flex-col gap-2 pb-16">
          {loading && <p className="text-sm text-neutral-500">Searching…</p>}
          {!loading && candidates.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-400">
              No candidates found. Try a broader query, or add more pools with ＋.
            </p>
          )}
          {!loading && candidates.length > 0 && (
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Showing {visibleCandidates.length} of {candidates.length}</span>
              <span className="flex items-center gap-3">
                <LegendDot className="border-orange-300 bg-orange-50" label="Program" />
                <LegendDot className="border-purple-300 bg-purple-50" label="Org" />
                <LegendDot className="border-blue-300 bg-blue-50" label="Focus" />
                <LegendDot className="border-emerald-300 bg-emerald-50" label="Degree" />
              </span>
            </div>
          )}
          {visibleCandidates.map((c, i) => (
            <div key={c.id} className="card flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1.5"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                title="Select to share / pull"
              />
              <Link href={`/dashboard/candidate/${c.id}`} className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-400">#{i + 1}</span>
                      <span className="font-semibold hover:underline">{c.name}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-neutral-600">
                      {c.headline ||
                        [c.experienceLevel, c.location, c.audienceTier].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {[c.isMine ? "my pool" : c.org.name, c.location, c.remoteOk ? "remote ok" : null]
                        .filter(Boolean)
                        .join(" · ")}
                      {c.originOrg ? ` · via ${c.originOrg.name}` : ""}
                    </div>
                  </div>
                  {c.matchPct !== null && (
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-bold text-purple-700">{c.matchPct}%</div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-400">match</div>
                    </div>
                  )}
                </div>

                {((c.credentials?.length ?? 0) > 0 || (c.topics?.length ?? 0) > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(c.credentials ?? []).slice(0, 5).map((cr) => (
                      <span key={cr} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${credentialClass(cr)}`}>
                        {cr}
                      </span>
                    ))}
                    {(c.topics ?? []).slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {c.summary && <p className="mt-2 text-sm text-neutral-600">{c.summary}</p>}

                {reasons[c.id] && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-purple-50/60 px-2.5 py-1.5 text-xs text-purple-900">
                    <span>✨</span>
                    <span>{reasons[c.id]}</span>
                  </div>
                )}

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-neutral-400">
                    {c.skills.slice(0, 6).map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                  {typeof c.cos === "number" && (
                    <span className="shrink-0 font-mono text-[10px] text-neutral-300">
                      cos {c.cos.toFixed(2)} → rerank {(c.score ?? 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}

      {criteriaOpen && (
        <CriteriaPanel
          initial={criteria}
          onClose={() => setCriteriaOpen(false)}
          onApply={(c) => {
            setCriteria(c);
            setCriteriaOpen(false);
            runSearch({ criteria: c });
          }}
        />
      )}
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-sm border ${className}`} />
      {label}
    </span>
  );
}

function FilterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

function CriteriaPanel({
  initial,
  onClose,
  onApply,
}: {
  initial: Criteria;
  onClose: () => void;
  onApply: (c: Criteria) => void;
}) {
  const [skills, setSkills] = useState(initial.skills.join(", "));
  const [roleInterest, setRoleInterest] = useState(initial.roleInterest.join(", "));
  const [experienceLevel, setExperienceLevel] = useState(initial.experienceLevel ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [remoteOk, setRemoteOk] = useState(initial.remoteOk ?? false);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/20 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">Criteria</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Describe who you&apos;re looking for. Results are ranked by how well they fit.
        </p>
        <div className="flex flex-col gap-3">
          <Field label="Skills (comma separated)">
            <input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="interpretability, RL" />
          </Field>
          <Field label="Role interest (comma separated)">
            <input className="input" value={roleInterest} onChange={(e) => setRoleInterest(e.target.value)} placeholder="research, policy" />
          </Field>
          <Field label="Experience level">
            <input className="input" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} placeholder="Senior" />
          </Field>
          <Field label="Location">
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Berkeley" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={remoteOk} onChange={(e) => setRemoteOk(e.target.checked)} />
            Prefer remote-friendly candidates
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              onApply({
                skills: commaList(skills),
                roleInterest: commaList(roleInterest),
                experienceLevel: experienceLevel.trim() || undefined,
                location: location.trim() || undefined,
                remoteOk: remoteOk || undefined,
              })
            }
          >
            Apply & rank
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-neutral-500">Loading…</div>}>
      <SearchWorkspace />
    </Suspense>
  );
}
