// Stage 1: dense retrieval over the live candidate set.
//
// Every candidate document is embedded into a normalized 384-dim vector and
// cached by content hash, so re-embedding only happens when a candidate's text
// actually changes. At query time we embed the query the same way and rank by
// cosine similarity (== dot product for L2-normalized vectors).
//
// This is exact brute-force nearest-neighbour, which is instant for pools up to
// tens of thousands. It's the swap point for Approximate Nearest Neighbour
// search: at millions of vectors, replace the linear scan below with an ANN
// index (HNSW via hnswlib-node, or pgvector / Qdrant). The query/embedding
// contract is unchanged, so nothing else in the pipeline moves.

import crypto from "node:crypto";
import { getBiEncoder } from "./models";

export interface SearchableCandidate {
  id: string;
  name: string;
  headline?: string | null;
  summary?: string | null;
  skills?: string[];
  roleInterest?: string[];
  topics?: string[];
  credentials?: string[];
  location?: string | null;
  experienceLevel?: string | null;
  notes?: string | null;
  rawFields?: unknown;
}

// The text we embed for a candidate: their structured signals + free-text
// answers, ordered most-salient first.
export function candidateDocument(c: SearchableCandidate): string {
  const parts: string[] = [c.name];
  if (c.headline) parts.push(c.headline);
  if (c.experienceLevel) parts.push(c.experienceLevel);
  if (c.location) parts.push(c.location);
  if (c.credentials?.length) parts.push("Credentials: " + c.credentials.join(", "));
  if (c.topics?.length) parts.push("Topics: " + c.topics.join(", "));
  if (c.skills?.length) parts.push("Skills: " + c.skills.join(", "));
  if (c.roleInterest?.length) parts.push("Interested in: " + c.roleInterest.join(", "));
  if (c.summary) parts.push(c.summary);
  if (c.notes) parts.push(c.notes.slice(0, 800));
  if (c.rawFields && typeof c.rawFields === "object") {
    parts.push(
      Object.values(c.rawFields as Record<string, unknown>)
        .map((v) => String(v ?? ""))
        .join(" ")
        .slice(0, 1500)
    );
  }
  return parts.join(". ");
}

const hash = (s: string) => crypto.createHash("sha1").update(s).digest("hex");

/** Embed one or more texts into normalized dense vectors. */
export async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await getBiEncoder();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// Process-lifetime cache: candidate id -> { content hash, vector }.
const cache = new Map<string, { hash: string; vector: number[] }>();

export interface RetrievalHit {
  candidate: SearchableCandidate;
  score: number; // cosine similarity in [-1, 1]
}

/**
 * Return the top-K candidates most similar to the query, embedding (and
 * caching) any candidate whose document text isn't cached or has changed.
 */
export async function retrieve(
  queryVector: number[],
  candidates: SearchableCandidate[],
  topK: number
): Promise<RetrievalHit[]> {
  // Figure out which candidates need (re)embedding this call.
  const docs = candidates.map((c) => ({ c, doc: candidateDocument(c), h: "" }));
  for (const d of docs) d.h = hash(d.doc);
  const stale = docs.filter((d) => cache.get(d.c.id)?.hash !== d.h);

  if (stale.length > 0) {
    const vectors = await embed(stale.map((d) => d.doc));
    stale.forEach((d, i) => cache.set(d.c.id, { hash: d.h, vector: vectors[i] }));
  }

  const scored: RetrievalHit[] = docs.map((d) => ({
    candidate: d.c,
    score: dot(queryVector, cache.get(d.c.id)!.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
