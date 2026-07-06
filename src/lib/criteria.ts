// Structured criteria used both for filtering and for ranking "top fits".
export type Criteria = {
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string;
  location?: string;
  remoteOk?: boolean;
};

export const EMPTY_CRITERIA: Criteria = {
  skills: [],
  roleInterest: [],
};

type ScorableCandidate = {
  skills: string[];
  roleInterest: string[];
  experienceLevel?: string | null;
  location?: string | null;
  remoteOk: boolean;
};

function norm(v: string) {
  return v.trim().toLowerCase();
}

// Returns a match score for a candidate against the criteria. One point per
// matched skill / role interest, plus one each for experience, location, and
// remote when specified and matching. Higher = better fit.
export function scoreCandidate(candidate: ScorableCandidate, criteria: Criteria): number {
  let score = 0;

  const candSkills = candidate.skills.map(norm);
  for (const s of criteria.skills) {
    if (candSkills.includes(norm(s))) score += 1;
  }

  const candRoles = candidate.roleInterest.map(norm);
  for (const r of criteria.roleInterest) {
    if (candRoles.includes(norm(r))) score += 1;
  }

  if (criteria.experienceLevel && candidate.experienceLevel) {
    if (norm(candidate.experienceLevel) === norm(criteria.experienceLevel)) score += 1;
  }

  if (criteria.location && candidate.location) {
    if (norm(candidate.location).includes(norm(criteria.location))) score += 1;
  }

  if (criteria.remoteOk && candidate.remoteOk) score += 1;

  return score;
}

// True when the criteria set has no active constraints.
export function isCriteriaEmpty(c: Criteria): boolean {
  return (
    c.skills.length === 0 &&
    c.roleInterest.length === 0 &&
    !c.experienceLevel &&
    !c.location &&
    !c.remoteOk
  );
}

// Max achievable score for a criteria set — used to render a match percentage.
export function maxScore(c: Criteria): number {
  return (
    c.skills.length +
    c.roleInterest.length +
    (c.experienceLevel ? 1 : 0) +
    (c.location ? 1 : 0) +
    (c.remoteOk ? 1 : 0)
  );
}

// ── Weighted criteria — for long-form criteria docs ─────────────────────────
//
// A short query ("senior interpretability researcher") maps cleanly onto flat
// Criteria. A long-form role description — the kind an org pastes in when
// asking a friend "send me people like this" — actually encodes three
// different kinds of signal that deserve different weight:
//   - required: hard must-haves ("1+ years PyTorch", "PhD with publications")
//   - preferred: bonus/nice-to-have ("open source contributions")
//   - domains: the subject-matter area, not a skill ("AI safety", "climate")
// WeightedCriteria keeps those buckets separate so scoring can weight a
// missing requirement very differently from a missing bonus.
export type WeightedCriteria = {
  required: string[];
  preferred: string[];
  domains: string[];
  roleInterest: string[];
  experienceLevel?: string;
  location?: string;
  remoteOk?: boolean;
};

export const EMPTY_WEIGHTED: WeightedCriteria = {
  required: [],
  preferred: [],
  domains: [],
  roleInterest: [],
};

type TextCandidate = ScorableCandidate & {
  name?: string;
  notes?: string | null;
  rawFields?: unknown;
};

// Every matchable field flattened into one lowercase blob — required/
// preferred/domain phrases are checked as substrings against this, so a
// requirement like "PyTorch" matches whether it showed up in the skills
// column or buried in a free-text application answer.
function textBlob(c: TextCandidate): string {
  const parts = [
    c.skills.join(" "),
    c.roleInterest.join(" "),
    c.experienceLevel ?? "",
    c.location ?? "",
    c.notes ?? "",
    c.rawFields && typeof c.rawFields === "object"
      ? Object.values(c.rawFields as Record<string, unknown>).map(String).join(" ")
      : "",
  ];
  return parts.join(" ").toLowerCase();
}

export type WeightedScore = { score: number; requiredHits: number; requiredTotal: number };

// Weights: a missing requirement costs 3x more than a missing bonus, and
// domain matches (topic fit) sit between the two. This is stage 1 of the
// matching pipeline — cheap, deterministic recall over the whole pool. See
// lib/ai.ts#aiRerank for stage 2 (precision, on the shortlist stage 1 produces).
export function scoreWeighted(candidate: TextCandidate, wc: WeightedCriteria): WeightedScore {
  const blob = textBlob(candidate);
  let score = 0;
  let requiredHits = 0;

  for (const r of wc.required) {
    if (blob.includes(norm(r))) {
      score += 3;
      requiredHits += 1;
    }
  }
  for (const p of wc.preferred) {
    if (blob.includes(norm(p))) score += 1;
  }
  for (const d of wc.domains) {
    if (blob.includes(norm(d))) score += 2;
  }
  for (const ri of wc.roleInterest) {
    if (blob.includes(norm(ri))) score += 2;
  }
  if (wc.experienceLevel && candidate.experienceLevel && norm(candidate.experienceLevel) === norm(wc.experienceLevel)) {
    score += 1;
  }
  if (wc.location && candidate.location && norm(candidate.location).includes(norm(wc.location))) {
    score += 1;
  }
  if (wc.remoteOk && candidate.remoteOk) score += 1;

  return { score, requiredHits, requiredTotal: wc.required.length };
}

export function maxWeightedScore(wc: WeightedCriteria): number {
  return (
    wc.required.length * 3 +
    wc.preferred.length +
    wc.domains.length * 2 +
    wc.roleInterest.length * 2 +
    (wc.experienceLevel ? 1 : 0) +
    (wc.location ? 1 : 0) +
    (wc.remoteOk ? 1 : 0)
  );
}

export function isWeightedEmpty(wc: WeightedCriteria): boolean {
  return (
    wc.required.length === 0 &&
    wc.preferred.length === 0 &&
    wc.domains.length === 0 &&
    wc.roleInterest.length === 0 &&
    !wc.experienceLevel &&
    !wc.location &&
    !wc.remoteOk
  );
}
