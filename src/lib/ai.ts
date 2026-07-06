import Anthropic from "@anthropic-ai/sdk";
import {
  type Criteria,
  type WeightedCriteria,
  EMPTY_WEIGHTED,
  scoreWeighted,
  maxWeightedScore,
} from "@/lib/criteria";
import { CANDIDATE_FIELDS, type FieldMapping } from "@/lib/candidateFields";

// AI layer for smart search. Everything here degrades gracefully: if no
// ANTHROPIC_API_KEY is configured (or a call fails), callers fall back to
// plain keyword search — the app never hard-depends on the API being up.
// Timeout is generous (60s) with a retry so transient slowness doesn't drop us
// to the inaccurate keyword path; the per-request search model is fast enough
// that we rarely get near it.
const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ timeout: 60_000, maxRetries: 2 })
  : null;

export const aiAvailable = Boolean(client);

// Model used for the latency-sensitive search path (criteria derivation +
// per-candidate evaluation). Haiku is several times faster than Opus and more
// than accurate enough for scored judgments, which is what makes evaluated
// search quick and reliable instead of timing out and falling back to keywords.
const SEARCH_MODEL = "claude-haiku-4-5-20251001";

export type ParsedQuery = {
  keywords: string[];
  criteria: Criteria;
};

const PARSE_SCHEMA = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      items: { type: "string" },
      description:
        "Literal text to match against candidate records: names, emails, or distinctive proper nouns. Empty if the query is purely descriptive.",
    },
    skills: {
      type: "array",
      items: { type: "string" },
      description: "Skills or research areas the searcher wants, normalized to short lowercase phrases.",
    },
    roleInterest: {
      type: "array",
      items: { type: "string" },
      description: "Role types wanted (e.g. research, policy, engineering, communications, operations).",
    },
    experienceLevel: {
      type: ["string", "null"],
      description: "Seniority if specified (e.g. Junior, Mid, Senior), else null.",
    },
    location: {
      type: ["string", "null"],
      description: "Location if specified, else null.",
    },
    remoteOk: {
      type: ["boolean", "null"],
      description: "true if the searcher wants remote-friendly candidates, else null.",
    },
  },
  required: ["keywords", "skills", "roleInterest", "experienceLevel", "location", "remoteOk"],
  additionalProperties: false,
} as const;

// Turns a free-text recruiting query ("senior interpretability researchers in
// Berkeley, remote ok") into structured criteria the scorer can rank on.
export async function parseQuery(query: string): Promise<ParsedQuery | null> {
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: {
        format: { type: "json_schema", schema: PARSE_SCHEMA },
        effort: "low",
      },
      system:
        "You parse talent-search queries for a recruiting platform used by AI-safety fellowships and hiring orgs. " +
        "Extract structured search criteria from the user's query. Normalize skills to short lowercase phrases. " +
        "Only put text in keywords if it should be matched literally (a person's name, an email, a very distinctive term).",
      messages: [{ role: "user", content: query }],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as {
      keywords: string[];
      skills: string[];
      roleInterest: string[];
      experienceLevel: string | null;
      location: string | null;
      remoteOk: boolean | null;
    };
    return {
      keywords: parsed.keywords,
      criteria: {
        skills: parsed.skills,
        roleInterest: parsed.roleInterest,
        experienceLevel: parsed.experienceLevel ?? undefined,
        location: parsed.location ?? undefined,
        remoteOk: parsed.remoteOk ?? undefined,
      },
    };
  } catch {
    return null; // fall back to keyword search
  }
}

// ── Org profile from a website ──────────────────────────────────────────────

export type DerivedOrg = {
  name: string | null;
  description: string | null;
  orgType: "fellowship" | "hiring" | "both" | null;
  focusAreas: string[];
};

const ORG_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: ["string", "null"],
      description: "The organization or program's name, exactly as it presents itself. Null if unclear.",
    },
    description: {
      type: ["string", "null"],
      description: "A concise 1-2 sentence summary of what this org/program does and who it serves, in a neutral third-person voice.",
    },
    orgType: {
      type: ["string", "null"],
      enum: ["fellowship", "hiring", "both", null],
      description:
        "'fellowship' if it runs cohorts/programs that produce alumni, 'hiring' if it's an employer sourcing candidates, 'both' if it does both, null if unclear.",
    },
    focusAreas: {
      type: "array",
      items: { type: "string" },
      description:
        "3-8 short focus-area tags describing the talent/domains involved (e.g. 'Interpretability', 'Policy', 'Engineering', 'Field-building'). Title Case.",
    },
  },
  required: ["name", "description", "orgType", "focusAreas"],
  additionalProperties: false,
} as const;

// Pulls a site's homepage, strips it to readable text, and asks Claude to
// derive an org profile (name, one-liner, type, focus areas). Degrades to null
// on any failure so the onboarding form just stays manually editable.
export async function deriveOrgFromWebsite(url: string): Promise<DerivedOrg | null> {
  if (!client) return null;
  let text: string;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const res = await fetch(normalized, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RefrBot/1.0)" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip scripts/styles, drop tags, collapse whitespace; cap length.
    text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
    if (text.length < 40) return null;
  } catch {
    return null;
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: ORG_SCHEMA }, effort: "low" },
      system:
        "You profile organizations for a talent-sharing platform used by AI-safety fellowships and hiring orgs. " +
        "Given the visible text of an org's website, extract a concise, factual profile. " +
        "Never invent details that aren't supported by the text; use null / empty when unsure.",
      messages: [{ role: "user", content: `Website text:\n\n${text}` }],
    });
    const out = response.content.find((b) => b.type === "text")?.text;
    if (!out) return null;
    const parsed = JSON.parse(out) as DerivedOrg;
    return {
      name: parsed.name?.trim() || null,
      description: parsed.description?.trim() || null,
      orgType: parsed.orgType ?? null,
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.slice(0, 8) : [],
    };
  } catch {
    return null;
  }
}

// ── Column auto-mapping ─────────────────────────────────────────────────────

export type AutoMap = {
  mapping: FieldMapping;
  // Raw columns worth keeping on the record (contact + substantive answers),
  // excluding noise like timestamps, row ids, internal scoring columns.
  includeColumns: string[];
};

// Heuristic fallback used when no AI key is configured: normalized-name match
// of each source column against our canonical fields, keeping all columns.
export function heuristicMap(headers: string[]): AutoMap {
  const mapping: FieldMapping = {};
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const aliases: Record<string, string[]> = {
    name: ["name", "fullname", "applicant", "candidate"],
    email: ["email", "emailaddress", "mail"],
    phone: ["phone", "phonenumber", "mobile", "tel"],
    skills: ["skills", "expertise", "areas", "tags"],
    roleInterest: ["role", "roleinterest", "interest", "track", "position"],
    experienceLevel: ["experience", "level", "seniority", "years"],
    location: ["location", "city", "country", "region", "based"],
    remoteOk: ["remote", "remoteok", "remotefriendly"],
    linkedinUrl: ["linkedin", "url", "portfolio", "website", "profile"],
    resumeUrl: ["resume", "cv", "resumeurl"],
    notes: ["notes", "about", "bio", "summary"],
  };
  for (const field of CANDIDATE_FIELDS) {
    const alias = aliases[field.key] ?? [field.key];
    const match = headers.find((h) => alias.includes(norm(h)));
    if (match) mapping[field.key] = match;
  }
  return { mapping, includeColumns: headers };
}

const AUTOMAP_SCHEMA = {
  type: "object",
  properties: {
    mapping: {
      type: "object",
      description:
        "Maps each of our canonical fields to the best-matching source column name, or null if none fits.",
      properties: Object.fromEntries(
        CANDIDATE_FIELDS.map((f) => [f.key, { type: ["string", "null"] }])
      ),
      required: CANDIDATE_FIELDS.map((f) => f.key),
      additionalProperties: false,
    },
    includeColumns: {
      type: "array",
      items: { type: "string" },
      description:
        "Source columns worth storing: contact details and substantive application answers. Exclude noise (timestamps, row ids, internal scores, consent checkboxes).",
    },
  },
  required: ["mapping", "includeColumns"],
  additionalProperties: false,
} as const;

// AI-maps arbitrary spreadsheet/form columns to our canonical candidate fields
// and picks which raw columns are worth keeping — so importers never hand-map.
// Falls back to the heuristic mapper when the API is unavailable or errors.
export async function autoMapColumns(
  headers: string[],
  sampleRows: Record<string, string>[]
): Promise<AutoMap> {
  if (!client) return heuristicMap(headers);
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: {
        format: { type: "json_schema", schema: AUTOMAP_SCHEMA },
        effort: "low",
      },
      system:
        "You map columns from an applicant spreadsheet or form export onto a fixed candidate schema " +
        "for a talent-sharing platform. Use the sample values to disambiguate. Map each canonical field " +
        "to the single best source column (or null). For includeColumns, keep contact info and " +
        "substantive answers; drop timestamps, row ids, internal scores, and consent checkboxes.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            canonicalFields: CANDIDATE_FIELDS.map((f) => ({ key: f.key, label: f.label })),
            columns: headers,
            sampleRows: sampleRows.slice(0, 4),
          }),
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return heuristicMap(headers);
    const parsed = JSON.parse(text) as {
      mapping: Record<string, string | null>;
      includeColumns: string[];
    };
    const mapping: FieldMapping = {};
    for (const f of CANDIDATE_FIELDS) {
      const col = parsed.mapping[f.key];
      if (col && headers.includes(col)) mapping[f.key] = col;
    }
    const include = parsed.includeColumns.filter((c) => headers.includes(c));
    return { mapping, includeColumns: include.length ? include : headers };
  } catch {
    return heuristicMap(headers);
  }
}

type ExplainCandidate = {
  id: string;
  name: string;
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string | null;
  location?: string | null;
  remoteOk: boolean;
  notes?: string | null;
};

const EXPLAIN_SCHEMA = {
  type: "object",
  properties: {
    reasons: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          reason: { type: "string", description: "One concise sentence on why this candidate fits (or doesn't)." },
        },
        required: ["id", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["reasons"],
  additionalProperties: false,
} as const;

// One-line "why this candidate matches" for the top results — the
// Happenstance-style thinking column. One API call for the whole batch.
export async function explainMatches(
  query: string,
  criteria: Criteria,
  candidates: ExplainCandidate[]
): Promise<Record<string, string> | null> {
  if (!client || candidates.length === 0) return null;
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      output_config: {
        format: { type: "json_schema", schema: EXPLAIN_SCHEMA },
        effort: "low",
      },
      system:
        "You are helping a recruiter understand search results on a talent-sharing platform. " +
        "For each candidate, write one concise, specific sentence on how well they fit the search. " +
        "Ground every claim in the provided fields; never invent details.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            search: { query, criteria },
            candidates: candidates.map((c) => ({
              id: c.id,
              name: c.name,
              skills: c.skills,
              roleInterest: c.roleInterest,
              experienceLevel: c.experienceLevel,
              location: c.location,
              remoteOk: c.remoteOk,
              notes: c.notes?.slice(0, 300),
            })),
          }),
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { reasons: { id: string; reason: string }[] };
    return Object.fromEntries(parsed.reasons.map((r) => [r.id, r.reason]));
  } catch {
    return null;
  }
}

// ── Criteria docs: breaking down a long-form "who we're looking for" ───────
//
// A pasted job spec or persona description ("ML researcher... 1+ years...
// bonus for open source contributions...") mixes hard requirements, bonus
// signals, and topic/domain language in one paragraph. This splits it into
// WeightedCriteria so scoring (lib/criteria.ts#scoreWeighted) can tell "must
// have PyTorch" apart from "nice to have trading background."

const CRITERIA_DOC_SCHEMA = {
  type: "object",
  properties: {
    required: {
      type: "array",
      items: { type: "string" },
      description:
        "Hard requirements only: specific skills, tools, degrees, years of experience, or named " +
        "programs stated as must-haves. Short lowercase phrases, one requirement each.",
    },
    preferred: {
      type: "array",
      items: { type: "string" },
      description:
        "Bonus / nice-to-have signals explicitly framed as a plus, not required (e.g. 'bonus for...', 'ideally has...').",
    },
    domains: {
      type: "array",
      items: { type: "string" },
      description:
        "The subject-matter or topic area this role is about, distinct from a skill (e.g. 'AI safety', " +
        "'climate change', 'science communication'). Include named reference points (e.g. creators, publications) as domain signals.",
    },
    roleInterest: { type: "array", items: { type: "string" } },
    experienceLevel: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    remoteOk: { type: ["boolean", "null"] },
  },
  required: ["required", "preferred", "domains", "roleInterest", "experienceLevel", "location", "remoteOk"],
  additionalProperties: false,
} as const;

// Weak fallback when no AI key is configured: everything becomes a
// "preferred" signal (best-effort substring recall, no required/bonus
// distinction — that distinction needs language understanding).
export function heuristicCriteriaDoc(doc: string): WeightedCriteria {
  const words = doc
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((w) => w.length >= 4);
  const stop = new Set(["with", "have", "that", "this", "from", "your", "their", "they", "such", "also"]);
  const preferred = [...new Set(words.filter((w) => !stop.has(w)))].slice(0, 40);
  return { ...EMPTY_WEIGHTED, preferred };
}

// Breaks a long-form criteria doc into required / preferred / domain
// buckets. Falls back to the (much weaker) heuristic when no key is set.
export async function parseCriteriaDoc(doc: string): Promise<WeightedCriteria | null> {
  if (!client) return heuristicCriteriaDoc(doc);
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1536,
      output_config: {
        format: { type: "json_schema", schema: CRITERIA_DOC_SCHEMA },
        effort: "medium",
      },
      system:
        "You break down a long-form talent search brief (a role description, a persona, or a list of " +
        "traits) for a talent-sharing platform. Separate hard requirements from bonus/nice-to-have " +
        "signals — read the language carefully ('bonus for', 'ideally', 'may have' signal preferred; " +
        "plain statements of what the person must have or have done signal required). Domains are the " +
        "subject matter, not a skill. Normalize to short lowercase phrases.",
      messages: [{ role: "user", content: doc }],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return heuristicCriteriaDoc(doc);
    const parsed = JSON.parse(text) as {
      required: string[];
      preferred: string[];
      domains: string[];
      roleInterest: string[];
      experienceLevel: string | null;
      location: string | null;
      remoteOk: boolean | null;
    };
    return {
      required: parsed.required,
      preferred: parsed.preferred,
      domains: parsed.domains,
      roleInterest: parsed.roleInterest,
      experienceLevel: parsed.experienceLevel ?? undefined,
      location: parsed.location ?? undefined,
      remoteOk: parsed.remoteOk ?? undefined,
    };
  } catch {
    return heuristicCriteriaDoc(doc);
  }
}

// ── Stage 2: AI rerank ──────────────────────────────────────────────────────

export type RerankCandidate = {
  id: string;
  name: string;
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string | null;
  location?: string | null;
  remoteOk: boolean;
  notes?: string | null;
  rawFields?: unknown;
};

export type RerankResult = { id: string; score: number; reason: string };

const RERANK_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          score: { type: "integer", description: "Fit score 0-100." },
          reason: {
            type: "string",
            description: "One concise, specific sentence grounded in the candidate's actual fields.",
          },
        },
        required: ["id", "score", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

// Precision pass over a shortlist: reads full free-text context (notes, raw
// application answers) that stage-1 keyword scoring only substring-matches,
// and produces a 0-100 fit score with a grounded reason per candidate. Meant
// to run on ~20 candidates, not a whole pool — that's what stage 1 is for.
export async function aiRerank(
  criteriaText: string,
  candidates: RerankCandidate[]
): Promise<RerankResult[] | null> {
  if (!client || candidates.length === 0) return null;
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      output_config: {
        format: { type: "json_schema", schema: RERANK_SCHEMA },
        effort: "medium",
      },
      system:
        "You are a precise talent-matching evaluator for a talent-sharing platform. Given a role/" +
        "criteria description and a shortlist of candidates, score each candidate's fit from 0-100 and " +
        "write one grounded sentence explaining the score. Weight explicit requirements heavily; a " +
        "candidate missing a stated hard requirement should score well below one who meets it, even if " +
        "otherwise strong. Never invent facts not present in the candidate's fields. Return a result " +
        "for every candidate id given, in any order.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            criteria: criteriaText,
            candidates: candidates.map((c) => ({
              id: c.id,
              name: c.name,
              skills: c.skills,
              roleInterest: c.roleInterest,
              experienceLevel: c.experienceLevel,
              location: c.location,
              remoteOk: c.remoteOk,
              notes: c.notes?.slice(0, 400),
              answers:
                c.rawFields && typeof c.rawFields === "object"
                  ? Object.fromEntries(
                      Object.entries(c.rawFields as Record<string, unknown>).map(([k, v]) => [
                        k,
                        String(v).slice(0, 300),
                      ])
                    )
                  : undefined,
            })),
          }),
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as { results: RerankResult[] };
    return parsed.results.sort((a, b) => b.score - a.score);
  } catch {
    return null;
  }
}

// ── Two-stage pipeline ───────────────────────────────────────────────────────
//
// Stage 1 (recall, cheap, deterministic): score the whole candidate set with
// keyword/skill overlap (scoreWeighted) and take the top N. Stage 2
// (precision, AI): re-read that shortlist in full and produce a calibrated
// 0-100 score + reason. This is the same recall-then-rerank shape search
// engines and RAG systems use — cheap over everything, expensive only on the
// slice that's likely to matter.
export type RankedCandidate<T> = T & {
  stage1Score: number;
  aiScore: number | null;
  reason: string | null;
  matchPct: number;
};

export async function rankCandidates<T extends RerankCandidate>(
  criteriaText: string,
  weighted: WeightedCriteria,
  candidates: T[],
  topN = 20
): Promise<RankedCandidate<T>[]> {
  const max = maxWeightedScore(weighted);
  const stage1 = candidates
    .map((c) => ({ candidate: c, ...scoreWeighted(c, weighted) }))
    .sort((a, b) => b.score - a.score);

  const shortlist = stage1.slice(0, topN);
  const reranked = criteriaText.trim() ? await aiRerank(criteriaText, shortlist.map((s) => s.candidate)) : null;
  const byId = new Map(reranked?.map((r) => [r.id, r]) ?? []);

  return stage1.map(({ candidate, score }) => {
    const ai = byId.get(candidate.id);
    return {
      ...candidate,
      stage1Score: score,
      aiScore: ai?.score ?? null,
      reason: ai?.reason ?? null,
      matchPct: ai ? ai.score : max > 0 ? Math.round((score / max) * 100) : 0,
    };
  });
}

// ── Journey mapping ─────────────────────────────────────────────────────────
//
// A candidate's application answers usually contain their trajectory in prose
// (education, programs, past roles). This extracts that into an ordered
// pipeline — e.g. UCLA → EA@UCLA → SPAR → MATS → Apollo — plus a one-line
// narrative. Reads the merged profile's answers, not our internal share events.

export type JourneyStep = { label: string; detail?: string };

const JOURNEY_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      description: "Ordered career/journey milestones, earliest first.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short milestone label, e.g. 'UCLA', 'MATS', 'Apollo Research'." },
          detail: { type: ["string", "null"], description: "Optional role/year/context, one short phrase." },
        },
        required: ["label", "detail"],
        additionalProperties: false,
      },
    },
    narrative: { type: "string", description: "One or two sentences summarizing where they are and how they got there." },
  },
  required: ["steps", "narrative"],
  additionalProperties: false,
} as const;

export async function summarizeJourney(profile: {
  name: string;
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string | null;
  location?: string | null;
  notes?: string | null;
  answers?: Record<string, unknown> | null;
}): Promise<{ steps: JourneyStep[]; narrative: string } | null> {
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: {
        format: { type: "json_schema", schema: JOURNEY_SCHEMA },
        effort: "low",
      },
      system:
        "You map a candidate's talent journey from their application answers. Extract the ordered " +
        "sequence of schools, programs, fellowships, orgs, and roles they've moved through (e.g. " +
        "university → student group → research program → fellowship → current org). Use only what's " +
        "present in the data; never invent milestones. If the trajectory is unclear, return the few " +
        "steps you can support. Keep labels short.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            name: profile.name,
            skills: profile.skills,
            roleInterest: profile.roleInterest,
            experienceLevel: profile.experienceLevel,
            location: profile.location,
            notes: profile.notes?.slice(0, 1000),
            answers: profile.answers
              ? Object.fromEntries(
                  Object.entries(profile.answers).map(([k, v]) => [k, String(v).slice(0, 500)])
                )
              : undefined,
          }),
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return null;
    return JSON.parse(text) as { steps: JourneyStep[]; narrative: string };
  } catch {
    return null;
  }
}

// ── Domain profile extraction ───────────────────────────────────────────────
//
// Turns a messy application (all raw answers) into a structured, domain-aware
// profile: headline, summary, links, topics, credential/signal tags, audience
// tier, and the applicant's consent to be shared. Credentials use a canonical
// AI-safety + creator taxonomy so the same signal reads the same across orgs
// and can be faceted/highlighted. Batched; heuristic fallback with no key.

// Canonical credential tags. The extractor is told to prefer these labels; the
// heuristic fallback scans raw text for them directly.
export const CREDENTIAL_TAXONOMY: { tag: string; patterns: string[] }[] = [
  { tag: "MATS", patterns: ["mats", "ml alignment theory scholars"] },
  { tag: "ARENA", patterns: ["arena"] },
  { tag: "SPAR", patterns: ["spar", "supervised program for alignment"] },
  { tag: "MARS", patterns: ["mars ", "cambridge ai safety"] },
  { tag: "LASR Labs", patterns: ["lasr"] },
  { tag: "BlueDot / AISF", patterns: ["blue dot", "bluedot", "ai safety fundamentals", "aisf"] },
  { tag: "EA university group", patterns: ["ea club", "effective altruism club", "ea university", "ea group", "ea at "] },
  { tag: "Alignment Forum / LW author", patterns: ["alignment forum", "lesswrong", "less wrong"] },
  { tag: "PhD", patterns: ["phd", "ph.d", "doctoral", "doctorate"] },
  { tag: "First-author publication", patterns: ["first author", "first-author", "neurips", "iclr", "icml", "published in"] },
  { tag: "Open-source contributor", patterns: ["open source", "open-source", "github.com/", "contributor to"] },
  { tag: "AI safety org", patterns: ["apollo research", "redwood research", "anthropic", "deepmind", "openai safety", "conjecture", "eleuther"] },
  { tag: "Viral creator (100k+)", patterns: ["100k views", "million views", "viral", "1m views", "went viral"] },
  { tag: "Founder", patterns: ["founder", "co-founder", "founded", "ceo of"] },
];

export type ExtractedProfile = {
  headline: string | null;
  summary: string | null;
  links: Record<string, string>;
  topics: string[];
  credentials: string[];
  audienceTier: string | null;
  consentToShare: boolean;
};

function blob(c: Record<string, unknown>): string {
  return Object.values(c).map((v) => String(v ?? "")).join(" \n ");
}

// No-AI fallback: pull links + known credentials + a follower tier out of the
// raw text with regex/keyword matching.
export function heuristicProfile(raw: Record<string, unknown>): ExtractedProfile {
  const text = blob(raw);
  const low = text.toLowerCase();

  const links: Record<string, string> = {};
  const grab = (host: string, key: string) => {
    const m = text.match(new RegExp(`https?://[^\\s,"']*${host}[^\\s,"']*`, "i"));
    if (m) links[key] = m[0];
  };
  grab("linkedin\\.com", "linkedin");
  grab("youtube\\.com", "youtube");
  grab("youtu\\.be", "youtube");
  grab("twitter\\.com", "twitter");
  grab("x\\.com", "twitter");
  grab("github\\.com", "github");

  const credentials = CREDENTIAL_TAXONOMY.filter((c) =>
    c.patterns.some((p) => low.includes(p))
  ).map((c) => c.tag);

  let audienceTier: string | null = null;
  const tierMatch = low.match(/(\d[\d,.]*\s*[km]?)\s*(?:\+)?\s*(?:subscribers|followers|views)/);
  if (tierMatch) audienceTier = tierMatch[0];

  // Consent: look for a "share with partners" style answer.
  let consentToShare = true;
  for (const [k, v] of Object.entries(raw)) {
    if (/shar\w*.*(partner|information|other org)/i.test(k) || /(consent|share).*(partner)/i.test(k)) {
      consentToShare = !/\bno\b|not? open|decline|opt.?out/i.test(String(v).toLowerCase());
    }
  }

  return { headline: null, summary: null, links, topics: [], credentials, audienceTier, consentToShare };
}

const PROFILE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    index: { type: "integer" },
    headline: { type: ["string", "null"], description: "One short line: who they are (role + focus)." },
    summary: { type: ["string", "null"], description: "2-3 sentences on their background, work, and relevance." },
    links: {
      type: "object",
      description: "Any social/portfolio URLs found.",
      properties: {
        linkedin: { type: ["string", "null"] },
        youtube: { type: ["string", "null"] },
        twitter: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
        github: { type: ["string", "null"] },
        portfolio: { type: ["string", "null"] },
      },
      required: ["linkedin", "youtube", "twitter", "website", "github", "portfolio"],
      additionalProperties: false,
    },
    topics: { type: "array", items: { type: "string" }, description: "Normalized focus areas / subject matter." },
    credentials: { type: "array", items: { type: "string" }, description: "Signal tags, preferring the provided taxonomy." },
    audienceTier: { type: ["string", "null"], description: "Follower/subscriber tier if a creator, else null." },
    consentToShare: { type: "boolean", description: "Did they agree to share their info with partner orgs? Default true if not asked." },
  },
  required: ["index", "headline", "summary", "links", "topics", "credentials", "audienceTier", "consentToShare"],
  additionalProperties: false,
} as const;

const PROFILES_SCHEMA = {
  type: "object",
  properties: { profiles: { type: "array", items: PROFILE_ITEM_SCHEMA } },
  required: ["profiles"],
  additionalProperties: false,
} as const;

// Extracts structured profiles for a batch of raw applications in one call.
// Falls back to the heuristic profile per-row if the API is unavailable.
export async function extractProfiles(
  rawRows: Record<string, unknown>[]
): Promise<ExtractedProfile[]> {
  if (!client) return rawRows.map(heuristicProfile);
  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      output_config: { format: { type: "json_schema", schema: PROFILES_SCHEMA }, effort: "low" },
      system:
        "You extract structured talent profiles from raw application answers for a talent-sharing " +
        "network spanning AI-safety research and AI/science content creation. For each applicant, write a " +
        "crisp headline and summary, pull out every social/portfolio link, normalize their focus areas into " +
        "topics, and tag credentials. Prefer these credential tags where they apply: " +
        CREDENTIAL_TAXONOMY.map((c) => c.tag).join(", ") +
        ". Only assign a credential if the text supports it — never invent one. Detect the applicant's consent " +
        "to be shared with partner orgs from any relevant question (default true if not asked). Return one entry " +
        "per applicant, echoing its index.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(
            rawRows.map((r, index) => ({
              index,
              answers: Object.fromEntries(
                Object.entries(r).map(([k, v]) => [k, String(v ?? "").slice(0, 800)])
              ),
            }))
          ),
        },
      ],
    });
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) return rawRows.map(heuristicProfile);
    const parsed = JSON.parse(text) as {
      profiles: (ExtractedProfile & { index: number; links: Record<string, string | null> })[];
    };
    const byIndex = new Map(parsed.profiles.map((p) => [p.index, p]));
    return rawRows.map((raw, i) => {
      const p = byIndex.get(i);
      if (!p) return heuristicProfile(raw);
      const links: Record<string, string> = {};
      for (const [k, v] of Object.entries(p.links ?? {})) if (v) links[k] = v;
      return {
        headline: p.headline,
        summary: p.summary,
        links,
        topics: p.topics ?? [],
        credentials: p.credentials ?? [],
        audienceTier: p.audienceTier,
        consentToShare: p.consentToShare ?? true,
      };
    });
  } catch {
    return rawRows.map(heuristicProfile);
  }
}

// ── Criteria evaluation (Juicebox-style: retrieve → LLM judge per criterion) ─
//
// Turns a search into an explainable evaluation: derive a few concrete criteria
// from the query, then judge each shortlisted candidate against each criterion
// with a status + a one-line evidence citation. This is what makes results feel
// accurate and shows "what they've done" — the embedding stage just supplies a
// cheap shortlist; the LLM does the judging on that shortlist only.

export type QueryCriterion = { key: string; label: string; description: string };

const CRITERIA_SCHEMA = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      description: "3–6 concrete, independently checkable criteria implied by the query.",
      items: {
        type: "object",
        properties: {
          key: { type: "string", description: "short lowercase id, e.g. 'safety'" },
          label: { type: "string", description: "1–2 word chip label, e.g. 'AI Safety'" },
          description: { type: "string", description: "what evidence would satisfy this" },
        },
        required: ["key", "label", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["criteria"],
  additionalProperties: false,
} as const;

export async function deriveCriteria(query: string): Promise<QueryCriterion[]> {
  if (!client) return [];
  try {
    const res = await client.messages.create({
      model: SEARCH_MODEL,
      max_tokens: 1024,
      output_config: { format: { type: "json_schema", schema: CRITERIA_SCHEMA }, effort: "low" },
      system:
        "You turn a talent-search request into a short list of concrete, independently checkable " +
        "criteria a recruiter would score candidates on. Prefer the hard requirements and the most " +
        "distinctive signals. Keep labels to 1–2 words. 3–6 criteria.",
      messages: [{ role: "user", content: query }],
    });
    const text = res.content.find((b) => b.type === "text")?.text;
    if (!text) return [];
    return (JSON.parse(text) as { criteria: QueryCriterion[] }).criteria ?? [];
  } catch {
    return [];
  }
}

export type CriterionVerdict = { key: string; status: "met" | "partial" | "missing"; evidence: string };
export type CandidateEvaluation = { id: string; score: number; summary: string; verdicts: CriterionVerdict[] };

const EVAL_SCHEMA = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          score: { type: "integer", description: "0–100 overall fit for the query." },
          summary: { type: "string", description: "One sentence on their fit, grounded in the data." },
          verdicts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                key: { type: "string" },
                status: { type: "string", enum: ["met", "partial", "missing"] },
                evidence: {
                  type: "string",
                  description: "Short evidence from the candidate's data, or why it's missing. Never invent.",
                },
              },
              required: ["key", "status", "evidence"],
              additionalProperties: false,
            },
          },
        },
        required: ["index", "score", "summary", "verdicts"],
        additionalProperties: false,
      },
    },
  },
  required: ["evaluations"],
  additionalProperties: false,
} as const;

type EvalCandidate = {
  id: string;
  name: string;
  headline?: string | null;
  summary?: string | null;
  credentials?: string[];
  topics?: string[];
  skills?: string[];
  experienceLevel?: string | null;
  location?: string | null;
  notes?: string | null;
  rawFields?: unknown;
};

function evalProfile(c: EvalCandidate) {
  return {
    name: c.name,
    headline: c.headline ?? undefined,
    summary: c.summary ?? undefined,
    credentials: c.credentials ?? [],
    topics: c.topics ?? [],
    skills: c.skills ?? [],
    experienceLevel: c.experienceLevel ?? undefined,
    location: c.location ?? undefined,
    answers:
      c.rawFields && typeof c.rawFields === "object"
        ? Object.fromEntries(
            Object.entries(c.rawFields as Record<string, unknown>).map(([k, v]) => [k, String(v).slice(0, 500)])
          )
        : undefined,
    notes: c.notes?.slice(0, 600),
  };
}

// Judges a batch of candidates against the criteria. Batched internally to keep
// each call small and reliable. Falls back to empty (caller keeps embedding
// order) if the API is unavailable.
export async function evaluateCandidates(
  query: string,
  criteria: QueryCriterion[],
  candidates: EvalCandidate[]
): Promise<Map<string, CandidateEvaluation>> {
  const out = new Map<string, CandidateEvaluation>();
  if (!client || criteria.length === 0 || candidates.length === 0) return out;

  const BATCH = 6;
  const batches: EvalCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH) batches.push(candidates.slice(i, i + BATCH));

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const res = await client!.messages.create({
          model: SEARCH_MODEL,
          max_tokens: 4000,
          output_config: { format: { type: "json_schema", schema: EVAL_SCHEMA }, effort: "low" },
          system:
            "You are a recruiter evaluating candidates against a search. For each candidate, judge every " +
            "criterion: 'met', 'partial', or 'missing', with one line of concrete evidence drawn from their " +
            "data (cite the specific program, role, publication, or answer). If there's no evidence, say so and " +
            "mark 'missing' — never invent. Give an overall 0–100 score reflecting how many high-weight criteria " +
            "are met. Echo each candidate's index.",
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                query,
                criteria: criteria.map((c) => ({ key: c.key, label: c.label, description: c.description })),
                candidates: batch.map((c, i) => ({ index: i, ...evalProfile(c) })),
              }),
            },
          ],
        });
        const text = res.content.find((b) => b.type === "text")?.text;
        if (!text) return;
        const parsed = JSON.parse(text) as {
          evaluations: (CandidateEvaluation & { index: number })[];
        };
        for (const e of parsed.evaluations) {
          const c = batch[e.index];
          if (c) out.set(c.id, { id: c.id, score: e.score, summary: e.summary, verdicts: e.verdicts ?? [] });
        }
      } catch {
        // leave this batch unevaluated; caller falls back to retrieval order
      }
    })
  );

  return out;
}
