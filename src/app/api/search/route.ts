import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreCandidate, maxScore, isCriteriaEmpty, EMPTY_CRITERIA, type Criteria } from "@/lib/criteria";
import {
  aiAvailable,
  parseQuery,
  explainMatches,
  parseCriteriaDoc,
  rankCandidates,
  deriveCriteria,
  evaluateCandidates,
} from "@/lib/ai";
import { semanticSearch } from "@/lib/search/pipeline";

// Route handler runs on Node (Transformers.js needs the onnxruntime native addon).
export const runtime = "nodejs";

// Long free-text queries are treated as a "criteria doc" (a pasted role spec /
// persona) and run through the two-stage matcher instead of flat parsing.
const DOC_THRESHOLD = 180;

const criteriaSchema = z.object({
  skills: z.array(z.string()).default([]),
  roleInterest: z.array(z.string()).default([]),
  experienceLevel: z.string().optional(),
  location: z.string().optional(),
  remoteOk: z.boolean().optional(),
});

const schema = z.object({
  // Pools to search. Empty/omitted = own pool only.
  targetOrgIds: z.array(z.string()).max(50).optional(),
  query: z.string().max(500).optional(),
  criteria: criteriaSchema.optional(),
  // smart: parse the free-text query with AI into criteria (default on when
  // a key is configured). explain: add one-line AI fit notes for top results.
  smart: z.boolean().optional(),
  explain: z.boolean().optional(),
});

// Cheap in-memory relevance prefilter used to build the evaluation shortlist
// when the embedding models aren't available. Ranks rows by how many query
// terms appear across their searchable text, falling back to input order
// (recency) for ties/zeroes — good enough to feed the LLM evaluator.
type PrefilterRow = {
  name: string;
  headline?: string | null;
  summary?: string | null;
  notes?: string | null;
  skills: string[];
  roleInterest: string[];
  topics?: string[];
  credentials?: string[];
};
function keywordPrefilter<T extends PrefilterRow>(rows: T[], query: string, n: number): T[] {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])];
  if (terms.length === 0) return rows.slice(0, n);
  const scored = rows.map((r, i) => {
    const hay = [
      r.name,
      r.headline ?? "",
      r.summary ?? "",
      r.notes ?? "",
      r.skills.join(" "),
      r.roleInterest.join(" "),
      (r.topics ?? []).join(" "),
      (r.credentials ?? []).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    const score = terms.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { r, score, i };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, n).map((x) => x.r);
}

function keywordWhere(words: string[]) {
  return words.flatMap((w) => [
    { name: { contains: w, mode: "insensitive" as const } },
    { location: { contains: w, mode: "insensitive" as const } },
    { experienceLevel: { contains: w, mode: "insensitive" as const } },
    { notes: { contains: w, mode: "insensitive" as const } },
    { email: { contains: w, mode: "insensitive" as const } },
    { skills: { has: w } },
    { roleInterest: { has: w } },
  ]);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const { query, criteria, explain } = parsed.data;
  const smart = parsed.data.smart ?? true;
  const requested = [...new Set(parsed.data.targetOrgIds ?? [])];
  const orgIds = requested.length > 0 ? requested : [user.orgId];

  // Validate every foreign pool against approved connections in one query.
  const foreign = orgIds.filter((id) => id !== user.orgId);
  if (foreign.length > 0) {
    const approved = await prisma.orgConnection.findMany({
      where: {
        status: "APPROVED",
        OR: [
          { orgAId: user.orgId, orgBId: { in: foreign } },
          { orgBId: user.orgId, orgAId: { in: foreign } },
        ],
      },
    });
    const allowed = new Set(
      approved.map((c) => (c.orgAId === user.orgId ? c.orgBId : c.orgAId))
    );
    const denied = foreign.filter((id) => !allowed.has(id));
    if (denied.length > 0) {
      return NextResponse.json(
        { error: "No approved connection with one of the selected pools." },
        { status: 403 }
      );
    }
  }

  // Consent gate: your own pool shows everyone; a friend's pool only shows
  // candidates who consented to being shared across orgs.
  const orClauses: Record<string, unknown>[] = [];
  if (orgIds.includes(user.orgId)) orClauses.push({ orgId: user.orgId });
  if (foreign.length > 0) orClauses.push({ orgId: { in: foreign }, consentToShare: true });
  const orgClause = { OR: orClauses };

  const q = query?.trim();

  // ── Evaluated search (primary when AI is available): retrieve → judge ──────
  // Embedding retrieval supplies a cheap shortlist; the LLM then scores each
  // candidate against criteria derived from the query and cites per-criterion
  // evidence ("what they've done"). This is the accurate, explainable path.
  if (q && smart && aiAvailable) {
    try {
      const rows = await prisma.candidate.findMany({
        where: orgClause,
        include: { originOrg: { select: { name: true } }, org: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        take: 2000,
      });
      if (rows.length > 0) {
        // Deriving criteria doesn't depend on the shortlist — kick it off now so
        // it runs concurrently with retrieval instead of after it.
        const criteriaPromise = deriveCriteria(q);

        const SHORTLIST_N = 24;
        let shortlist = rows;
        const cosById = new Map<string, number>();
        if (rows.length > SHORTLIST_N) {
          // Larger pools: narrow with embeddings, but never let that flaky/slow
          // path block the search — fall back to a cheap keyword prefilter
          // (much better than plain recency) if the models aren't available.
          try {
            // Bound the embedding step: a cold model download can take tens of
            // seconds, so cut it off and use the keyword prefilter instead.
            const hits = await Promise.race([
              semanticSearch(q, rows, { retrieveK: SHORTLIST_N, topN: SHORTLIST_N }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("embed timeout")), 8000)),
            ]);
            if (hits.length > 0) {
              const byId = new Map(rows.map((r) => [r.id, r]));
              shortlist = hits.map((h) => byId.get(h.id)!).filter(Boolean);
              hits.forEach((h) => cosById.set(h.id, h.retrievalScore));
            } else {
              shortlist = keywordPrefilter(rows, q, SHORTLIST_N);
            }
          } catch {
            shortlist = keywordPrefilter(rows, q, SHORTLIST_N);
          }
        }
        // Small pools skip retrieval entirely and evaluate everyone — faster and
        // strictly more accurate than shortlisting.

        const criteria = await criteriaPromise;
        if (criteria.length > 0) {
          const evals = await evaluateCandidates(q, criteria, shortlist);
          const candidates = shortlist
            .map((row) => {
              const ev = evals.get(row.id);
              return {
                ...row,
                isMine: row.orgId === user.orgId,
                score: ev?.score ?? 0,
                matchPct: ev ? (ev.score ?? 0) : null,
                cos: cosById.get(row.id),
                summary: ev?.summary ?? row.summary,
                verdicts: ev?.verdicts ?? [],
              };
            })
            .sort((a, b) => (b.matchPct ?? -1) - (a.matchPct ?? -1));

          return NextResponse.json({
            candidates,
            criteria,
            maxScore: 100,
            myOrgId: user.orgId,
            ai: null,
            aiDoc: null,
            aiAvailable,
            reasons: null,
            searchMode: "evaluated",
          });
        }
      }
    } catch (err) {
      console.error("Evaluated search failed, falling back:", err);
    }
  }

  // ── Semantic search: bi-encoder dense retrieval + cross-encoder rerank ─────
  // Primary path for any free-text query. Runs locally in-process (no API),
  // ranking the consent-gated pool by meaning rather than keywords. Falls
  // through to the AI/keyword paths below if the models can't load or error.
  if (q) {
    try {
      const rows = await prisma.candidate.findMany({
        where: orgClause,
        include: { originOrg: { select: { name: true } }, org: { select: { id: true, name: true, slug: true } } },
        take: 2000,
      });
      const results = await semanticSearch(q, rows);
      if (results.length > 0) {
        const byId = new Map(rows.map((r) => [r.id, r]));
        const candidates = results
          .map((r) => {
            const row = byId.get(r.id);
            return row
              ? {
                  ...row,
                  score: r.score,
                  matchPct: Math.round(r.score * 100),
                  cos: r.retrievalScore,
                  isMine: row.orgId === user.orgId,
                }
              : null;
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        let reasons: Record<string, string> | null = null;
        if (explain && aiAvailable && candidates.length > 0) {
          reasons = await explainMatches(q, EMPTY_CRITERIA, candidates.slice(0, 8));
        }
        return NextResponse.json({
          candidates,
          maxScore: 100,
          myOrgId: user.orgId,
          ai: null,
          aiDoc: null,
          aiAvailable,
          reasons,
          searchMode: "semantic",
        });
      }
    } catch (err) {
      console.error("Semantic search unavailable, falling back:", err);
    }
  }

  // ── Criteria-doc mode: two-stage match (recall → AI rerank) ───────────────
  // A long paste (a role spec or persona) gets broken into weighted required/
  // preferred/domain signals, scored across the whole accessible pool, then the
  // top slice is reranked in full by AI.
  if (q && smart && aiAvailable && q.length >= DOC_THRESHOLD) {
    const weighted = await parseCriteriaDoc(q);
    if (weighted) {
      const rows = await prisma.candidate.findMany({
        where: orgClause,
        include: { originOrg: { select: { name: true } }, org: { select: { id: true, name: true, slug: true } } },
        take: 1000,
      });
      const ranked = await rankCandidates(q, weighted, rows, 25);
      const reasons: Record<string, string> = {};
      const candidates = ranked.map((c) => {
        if (c.reason) reasons[c.id] = c.reason;
        return { ...c, matchPct: c.matchPct, score: c.aiScore ?? c.stage1Score, isMine: c.orgId === user.orgId };
      });
      return NextResponse.json({
        candidates,
        maxScore: 100,
        myOrgId: user.orgId,
        ai: null,
        aiDoc: weighted,
        aiAvailable,
        reasons,
        searchMode: "criteria-doc",
      });
    }
  }

  // Smart parse: turn the free-text query into structured criteria + literal
  // keywords. Falls back silently to plain keyword search on any failure.
  let aiCriteria: Criteria | null = null;
  let textFilter: string[] = q ? [q] : [];
  if (q && smart && aiAvailable) {
    const parsedQuery = await parseQuery(q);
    if (parsedQuery) {
      aiCriteria = isCriteriaEmpty(parsedQuery.criteria) ? null : parsedQuery.criteria;
      textFilter = parsedQuery.keywords;
    }
  }

  // Merge explicit criteria (from the criteria panel) with AI-derived ones.
  // Explicit values win for scalar fields; lists are unioned.
  const explicit = criteria;
  const activeCriteria: Criteria = {
    skills: [...new Set([...(explicit?.skills ?? []), ...(aiCriteria?.skills ?? [])])],
    roleInterest: [
      ...new Set([...(explicit?.roleInterest ?? []), ...(aiCriteria?.roleInterest ?? [])]),
    ],
    experienceLevel: explicit?.experienceLevel ?? aiCriteria?.experienceLevel,
    location: explicit?.location ?? aiCriteria?.location,
    remoteOk: explicit?.remoteOk ?? aiCriteria?.remoteOk,
  };
  const max = maxScore(activeCriteria);

  // When criteria are active we rank the whole pool; only apply a hard text
  // filter for literal keywords (names, emails) so descriptive queries like
  // "senior interpretability folks" don't textually exclude everyone.
  const where: Record<string, unknown> =
    textFilter.length > 0 && (max === 0 || !aiCriteria)
      ? { AND: [orgClause, { OR: keywordWhere(textFilter) }] }
      : orgClause;

  const rows = await prisma.candidate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      originOrg: { select: { name: true } },
      org: { select: { id: true, name: true, slug: true } },
    },
    take: 1000,
  });

  let scored = rows.map((c) => {
    const score = max > 0 ? scoreCandidate(c, activeCriteria) : 0;
    return {
      ...c,
      score,
      matchPct: max > 0 ? Math.round((score / max) * 100) : null,
      isMine: c.orgId === user.orgId,
    };
  });

  if (max > 0) {
    scored.sort((a, b) => b.score - a.score);
    // With AI-derived criteria and literal keywords, keep keyword hits ranked in.
    if (textFilter.length > 0 && aiCriteria) {
      const lower = textFilter.map((w) => w.toLowerCase());
      scored = scored.map((c) => {
        const hit = lower.some(
          (w) =>
            c.name.toLowerCase().includes(w) ||
            c.email?.toLowerCase().includes(w) ||
            c.skills.some((s) => s.toLowerCase().includes(w))
        );
        return hit ? { ...c, score: c.score + 1 } : c;
      });
      scored.sort((a, b) => b.score - a.score);
    }
  }

  // Optional: one-line AI fit notes for the top results.
  let reasons: Record<string, string> | null = null;
  if (explain && aiAvailable && scored.length > 0) {
    reasons = await explainMatches(q ?? "", activeCriteria, scored.slice(0, 8));
  }

  return NextResponse.json({
    candidates: scored,
    maxScore: max,
    myOrgId: user.orgId,
    ai: aiCriteria ? { criteria: aiCriteria, keywords: textFilter } : null,
    aiAvailable,
    reasons,
    // "browse" when there's no query at all (just listing/filtering the pool);
    // "keyword" when a query fell through every smart path to plain matching.
    searchMode: q ? "keyword" : "browse",
  });
}
