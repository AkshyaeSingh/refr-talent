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
  verdicts?: { key: string; status: "met" | "partial" | "missing"; evidence: string }[];
  org: { id: string; name: string };
  originOrg?: { name: string } | null;
  score: number;
  matchPct: number | null;
  isMine: boolean;
  createdAt?: string;
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

type SortKey = "match" | "name" | "recent";
const SORT_LABELS: Record<SortKey, string> = {
  match: "Best match",
  name: "Name (A–Z)",
  recent: "Recently added",
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

// Detailed, realistic example searches that exercise the evaluated pipeline and
// return useful, differentiated results (not one-word filters).
const EXAMPLES = [
  "Science communicators who can explain AI safety to a general audience — bonus for a large following",
  "Interpretability researchers with first-author papers, open to relocating to Berkeley or London",
  "Governance & policy people with DC experience who've been through BlueDot or a similar fellowship",
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

const VERDICT_STYLE: Record<string, { icon: string; pill: string }> = {
  met: { icon: "✓", pill: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  partial: { icon: "~", pill: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { icon: "✕", pill: "border-neutral-200 bg-neutral-50 text-neutral-400" },
};

function SearchWorkspace() {
  const params = useSearchParams();
  const savedId = params.get("s");

  const [friends, setFriends] = useState<FriendOrg[]>([]);
  const [myOrgId, setMyOrgId] = useState("");
  // Pools included in the search. "me" = own pool. Defaults to ALL accessible
  // pools (own + every friend) once connections load, unless the user narrows it.
  const [pools, setPools] = useState<Set<string>>(new Set(["me"]));
  // Only the setter is read (we branch on the previous value inside updaters).
  const [, setPoolsTouched] = useState(false);
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
  const [aiInfo, setAiInfo] = useState<{ criteria: Criteria; keywords: string[] } | null>(null);
  const [aiDoc, setAiDoc] = useState<{ required: string[]; preferred: string[]; domains: string[] } | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [queryCriteria, setQueryCriteria] = useState<{ key: string; label: string }[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("match");
  const [sortOpen, setSortOpen] = useState(false);
  const [facets, setFacets] = useState<Record<FacetKey, Set<string>>>({
    credential: new Set(), topic: new Set(), location: new Set(), source: new Set(), audience: new Set(),
  });
  const pickerRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const criteriaActive = !isCriteriaEmpty(criteria);
  const criteriaCount =
    criteria.skills.length +
    criteria.roleInterest.length +
    (criteria.experienceLevel ? 1 : 0) +
    (criteria.location ? 1 : 0) +
    (criteria.remoteOk ? 1 : 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPoolPickerOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
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
      setFacets({ credential: new Set(), topic: new Set(), location: new Set(), source: new Set(), audience: new Set() });
      setAiInfo(data.ai ?? null);
      setAiDoc(data.aiDoc ?? null);
      setQueryCriteria(data.criteria ?? []);
      setAiOn(Boolean(data.aiAvailable));
      setReasons(data.reasons ?? {});
      if (data.myOrgId) setMyOrgId(data.myOrgId);
    },
    [pools, query, criteria, myOrgId, resolveTargets]
  );

  // Load friend orgs (approved connections). Default the search to ALL pools.
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
        // Default to searching everything the org can see.
        setPoolsTouched((touched) => {
          if (!touched) setPools(new Set(["me", ...approved.map((f) => f.id)]));
          return touched;
        });
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
        setPoolsTouched(true);
        setPools(p);
        setQuery(s.query ?? "");
        setCriteria(c);
        runSearch({ pools: p, query: s.query ?? "", criteria: c });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId]);

  function setPoolsManual(next: Set<string>) {
    if (next.size === 0) next.add("me");
    setPoolsTouched(true);
    setPools(next);
  }
  function togglePool(id: string) {
    const next = new Set(pools);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPoolsManual(next);
  }
  function selectAllPools() {
    setPoolsManual(new Set(["me", ...friends.map((f) => f.id)]));
  }
  function selectOnlyMine() {
    setPoolsManual(new Set(["me"]));
  }

  const allPoolsSelected = pools.has("me") && friends.every((f) => pools.has(f.id));
  const poolSummary = allPoolsSelected
    ? "All pools"
    : pools.size === 1 && pools.has("me")
      ? "My pool"
      : `${pools.size} pool${pools.size === 1 ? "" : "s"}`;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Read an uploaded criteria doc (.txt/.md) as the query and search on it.
  function onCriteriaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "").trim();
      if (text) {
        setQuery(text);
        runSearch({ query: text });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

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
      out[k] = [...counts[k].entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    });
    return out;
  }, [candidates]);

  const activeFacetCount = useMemo(
    () => (Object.values(facets) as Set<string>[]).reduce((n, s) => n + s.size, 0),
    [facets]
  );

  const visibleCandidates = useMemo(() => {
    const filtered = activeFacetCount === 0
      ? candidates
      : candidates.filter((c) => {
          const vals = candidateFacetValues(c);
          return (Object.keys(facets) as FacetKey[]).every((k) => {
            const sel = facets[k];
            if (sel.size === 0) return true;
            return vals[k].some((v) => sel.has(v));
          });
        });
    const sorted = [...filtered];
    if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "recent") sorted.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    else sorted.sort((a, b) => (b.matchPct ?? -1) - (a.matchPct ?? -1));
    return sorted;
  }, [candidates, facets, activeFacetCount, sortBy]);

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
      if (c && !c.isMine) byOrg.set(c.org.id, [...(byOrg.get(c.org.id) ?? []), id]);
    }
    return byOrg;
  }, [selected, candidates]);

  const topFitIds = useMemo(() => ownResults.filter((c) => c.score > 0).map((c) => c.id), [ownResults]);
  const targetMode = friends.find((f) => f.id === shareTarget)?.shareMode ?? "MANUAL";

  async function saveSearch() {
    const name = window.prompt("Name this search (shows under History):");
    if (!name) return;
    await fetch("/api/searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, query, criteria: { ...criteria, _pools: [...pools] } }),
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
      `Shared ${data.copied} candidate(s)${data.skippedAlreadyCopied ? `, ${data.skippedAlreadyCopied} already there` : ""}.`
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
  const centered = !ran;

  // Pool selector — a summary button that opens a checklist of accessible pools.
  const poolSelector = (
    <div className="relative" ref={pickerRef}>
      <button
        className="chip flex items-center gap-1"
        onClick={() => setPoolPickerOpen((v) => !v)}
        title="Choose which pools to search"
      >
        <PoolIcon /> {poolSummary}
        <span className="text-neutral-400">▾</span>
      </button>
      {poolPickerOpen && (
        <div className="absolute left-0 top-9 z-30 w-64 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
          <div className="flex gap-1 px-1 pb-1.5">
            <button className="btn-ghost flex-1 text-xs" onClick={selectAllPools}>All pools</button>
            <button className="btn-ghost flex-1 text-xs" onClick={selectOnlyMine}>Only mine</button>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50">
            <input type="checkbox" checked={pools.has("me")} onChange={() => togglePool("me")} />
            My pool
          </label>
          {friends.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-neutral-400">Add friends to search their pools.</p>
          )}
          {friends.map((f) => (
            <label key={f.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50">
              <input type="checkbox" checked={pools.has(f.id)} onChange={() => togglePool(f.id)} />
              {f.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`mx-auto max-w-3xl px-6 ${centered ? "flex min-h-[70vh] flex-col justify-center" : "py-6"}`}>
      {centered && (
        <h1 className="mb-8 text-center text-4xl font-bold tracking-tight">Who are you looking for?</h1>
      )}

      {/* Search box — big hero when idle, compact sticky bar after a search */}
      <div
        className={
          centered
            ? "rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            : "sticky top-0 z-20 -mx-6 border-b border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur"
        }
      >
        <div className={centered ? "" : "mx-auto flex max-w-3xl items-center gap-2"}>
          {centered && <div className="mb-3">{poolSelector}</div>}
          {!centered && poolSelector}

          <textarea
            rows={centered ? 2 : 1}
            className={
              centered
                ? "w-full resize-none border-0 bg-transparent text-base outline-none placeholder:text-neutral-400"
                : "min-w-0 flex-1 resize-none border-0 bg-transparent text-sm outline-none placeholder:text-neutral-400"
            }
            placeholder="Describe who you're looking for — skills, credentials, location, seniority…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                runSearch();
              }
            }}
          />

          {centered ? (
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.text" className="hidden" onChange={onCriteriaFile} />
                <button className="chip flex items-center gap-1" onClick={() => fileRef.current?.click()} title="Upload a criteria doc (.txt/.md)">
                  <UploadIcon /> Upload criteria
                </button>
                <button
                  className={`chip flex items-center gap-1 ${criteriaActive ? "chip-active" : ""}`}
                  onClick={() => setCriteriaOpen(true)}
                  title="Set filters manually"
                >
                  <FilterIcon /> Manual filters{criteriaActive ? ` · ${criteriaCount}` : ""}
                </button>
              </div>
              <button
                onClick={() => runSearch()}
                disabled={loading}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
                title="Search"
              >
                <SearchArrow />
              </button>
            </div>
          ) : (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => runSearch()}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
                title="Search"
              >
                <SearchArrow />
              </button>
              <button
                className={`chip flex items-center gap-1 ${activeFacetCount > 0 || filtersOpen ? "chip-active" : ""}`}
                onClick={() => setFiltersOpen((v) => !v)}
                title="Filter results"
              >
                <FilterIcon /> Filter{activeFacetCount > 0 ? ` · ${activeFacetCount}` : ""}
              </button>
              <div className="relative" ref={sortRef}>
                <button className="chip flex items-center gap-1" onClick={() => setSortOpen((v) => !v)} title="Sort results">
                  <SortIcon /> {SORT_LABELS[sortBy]}
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-9 z-30 w-44 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
                    {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                      <button
                        key={k}
                        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-neutral-50 ${sortBy === k ? "font-semibold text-purple-700" : ""}`}
                        onClick={() => { setSortBy(k); setSortOpen(false); }}
                      >
                        {SORT_LABELS[k]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Example searches */}
      {centered && (
        <div className="mt-4 flex flex-col gap-2">
          <span className="text-center text-xs font-medium uppercase tracking-wide text-neutral-400">Try one of these</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className="rounded-xl border border-neutral-200 px-4 py-2.5 text-left text-sm text-neutral-600 transition-colors hover:border-purple-300 hover:bg-purple-50/40"
              onClick={() => { setQuery(ex); runSearch({ query: ex }); }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Post-search action bar */}
      {ran && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={saveSearch}>Save to History</button>

          {ownResults.length > 0 && friends.length > 0 && (
            <>
              <select className="input" value={shareTarget} onChange={(e) => setShareTarget(e.target.value)}>
                <option value="">Share with…</option>
                {friends.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button
                className={`btn-secondary ${shareTarget && targetMode === "ALL" ? "ring-2 ring-purple-200" : ""}`}
                onClick={() => share("all")}
                disabled={!shareTarget}
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
              <button className="btn-secondary" onClick={() => share("manual")} disabled={!shareTarget || ownSelected.length === 0}>
                Share selected ({ownSelected.length})
              </button>
            </>
          )}

          {foreignSelectedCount > 0 && (
            <button className="btn-primary" onClick={pull}>Pull selected ({foreignSelectedCount})</button>
          )}
        </div>
      )}

      {status && <p className="mt-3 text-sm text-purple-700">{status}</p>}

      {/* Criteria-doc breakdown */}
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
          {aiInfo.criteria.skills.map((s) => <span key={`ais-${s}`} className="badge-match">{s}</span>)}
          {aiInfo.criteria.roleInterest.map((r) => <span key={`air-${r}`} className="badge-match">{r}</span>)}
          {aiInfo.criteria.experienceLevel && <span className="badge">{aiInfo.criteria.experienceLevel}</span>}
          {aiInfo.criteria.location && <span className="badge">{aiInfo.criteria.location}</span>}
          {aiInfo.criteria.remoteOk && <span className="badge">remote ok</span>}
          {aiInfo.keywords.map((k) => <span key={`aik-${k}`} className="badge">“{k}”</span>)}
        </div>
      )}
      {ran && !aiOn && (
        <p className="mt-3 text-xs text-neutral-400">
          Smart search is off — set <code>ANTHROPIC_API_KEY</code> to enable natural-language queries. Using keyword search.
        </p>
      )}

      {/* Facet filters — revealed via the Filter button */}
      {ran && candidates.length > 0 && filtersOpen && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600">
              Filters{activeFacetCount > 0 ? ` · ${activeFacetCount}` : ""}
            </span>
            {activeFacetCount > 0 && (
              <button
                className="btn-ghost text-xs"
                onClick={() => setFacets({ credential: new Set(), topic: new Set(), location: new Set(), source: new Set(), audience: new Set() })}
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

      {/* Criteria the results are evaluated against */}
      {ran && queryCriteria.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-neutral-500">Evaluated against:</span>
          {queryCriteria.map((qc) => <span key={qc.key} className="chip">{qc.label}</span>)}
        </div>
      )}

      {/* Results */}
      {ran && (
        <div className="mt-5 flex flex-col gap-2 pb-16">
          {loading && <p className="text-sm text-neutral-500">✨ Evaluating candidates against your criteria…</p>}
          {!loading && candidates.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-400">
              No candidates found. Try a broader query, or widen the pools.
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-neutral-400">#{i + 1}</span>
                      <span className="font-semibold hover:underline">{c.name}</span>
                      {/* Pool tag — which pool this applicant belongs to */}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          c.isMine
                            ? "border border-purple-200 bg-purple-50 text-purple-700"
                            : "border border-neutral-200 bg-neutral-50 text-neutral-600"
                        }`}
                      >
                        {c.isMine ? "My pool" : c.org.name}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-neutral-600">
                      {c.headline || [c.experienceLevel, c.location, c.audienceTier].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {[c.location, c.remoteOk ? "remote ok" : null].filter(Boolean).join(" · ")}
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
                      <span key={cr} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${credentialClass(cr)}`}>{cr}</span>
                    ))}
                    {(c.topics ?? []).slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{t}</span>
                    ))}
                  </div>
                )}

                {c.summary && <p className="mt-2 text-sm text-neutral-600">{c.summary}</p>}

                {/* Per-criterion evidence (what they've done) */}
                {(c.verdicts?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {c.verdicts!.map((v) => {
                      const label = queryCriteria.find((qc) => qc.key === v.key)?.label ?? v.key;
                      const s = VERDICT_STYLE[v.status] ?? VERDICT_STYLE.missing;
                      return (
                        <div key={v.key} className="flex items-start gap-2 text-xs">
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${s.pill}`}>
                            {s.icon} {label}
                          </span>
                          <span className="text-neutral-600">{v.evidence}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {reasons[c.id] && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-purple-50/60 px-2.5 py-1.5 text-xs text-purple-900">
                    <span>✨</span>
                    <span>{reasons[c.id]}</span>
                  </div>
                )}

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-neutral-400">
                    {c.skills.slice(0, 6).map((s) => <span key={s}>{s}</span>)}
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
function UploadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  );
}
function SortIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h13M3 12h9M3 18h5M17 8V4m0 0-2 2m2-2 2 2M17 16v4m0 0 2-2m-2 2-2-2" />
    </svg>
  );
}
function PoolIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function SearchArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 19V5M5 12l7-7 7 7" />
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
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Manual filters</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Set specific criteria. Results are ranked by how well they fit.
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
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
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
