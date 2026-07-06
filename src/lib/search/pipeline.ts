// The two-stage semantic search pipeline.
//
//   query
//     │  Stage 1 — Bi-Encoder dense retrieval (fast, approximate)
//     ▼  embed(query) → cosine top-K over candidate vectors
//   shortlist
//     │  Stage 2 — Cross-Encoder re-ranking (slow, accurate)
//     ▼  score each (query, candidate) pair jointly
//   ranked candidates

import { candidateDocument, embed, retrieve, type SearchableCandidate } from "./embeddings";
import { getCrossEncoder } from "./models";

export interface SemanticResult {
  id: string;
  score: number; // cross-encoder relevance in [0, 1]
  retrievalScore: number; // stage-1 cosine, kept for transparency
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Cross-encoder rerank: each (query, document) pair is fed through the model
// together, catching relevance the bi-encoder misses — affordable only on a
// shortlist.
async function rerank(query: string, documents: string[]): Promise<number[]> {
  const { tokenizer, model } = await getCrossEncoder();
  const inputs = tokenizer(new Array(documents.length).fill(query), {
    text_pair: documents,
    padding: true,
    truncation: true,
  });
  const { logits } = await model(inputs);
  return (logits.tolist() as number[][]).map(([logit]) => sigmoid(logit));
}

export interface SemanticOptions {
  retrieveK?: number; // how many stage 1 hands to stage 2
  topN?: number; // how many reranked results to return
}

/** Run retrieve-then-rerank over the given candidate pool for a free-text query. */
export async function semanticSearch(
  query: string,
  candidates: SearchableCandidate[],
  { retrieveK = 40, topN = 60 }: SemanticOptions = {}
): Promise<SemanticResult[]> {
  const trimmed = query.trim();
  if (!trimmed || candidates.length === 0) return [];

  const [queryVector] = await embed([trimmed]);
  const hits = await retrieve(queryVector, candidates, retrieveK);
  if (hits.length === 0) return [];

  const documents = hits.map((h) => candidateDocument(h.candidate));
  const rerankScores = await rerank(trimmed, documents);

  return hits
    .map((hit, i) => ({
      id: hit.candidate.id,
      score: rerankScores[i],
      retrievalScore: hit.score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
