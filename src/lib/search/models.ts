// Model loading for the two-stage embedding search.
//
// Both models run in-process via Transformers.js (ONNX Runtime). They are
// loaded lazily and cached at module scope so the (expensive) download + warm-up
// happens once per server process, not once per request.
//
// Stage 1 (retrieval): a bi-encoder sentence-transformer mapping text to a
//   single dense vector — query and documents embedded independently, so
//   document vectors can be precomputed and indexed.
// Stage 2 (re-ranking): a cross-encoder reading a (query, document) pair
//   together and emitting one relevance score. More accurate, far more
//   expensive — so it only ever sees the shortlist from stage 1.

import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  pipeline,
  type FeatureExtractionPipeline,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";

// Bi-encoder: 384-dim embeddings, the de-facto default for semantic search.
export const BI_ENCODER_MODEL = "Xenova/all-MiniLM-L6-v2";
// Cross-encoder: trained on MS MARCO for query/passage relevance ranking.
export const CROSS_ENCODER_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2";

let biEncoderPromise: Promise<FeatureExtractionPipeline> | null = null;

export function getBiEncoder(): Promise<FeatureExtractionPipeline> {
  if (!biEncoderPromise) {
    biEncoderPromise = pipeline("feature-extraction", BI_ENCODER_MODEL);
  }
  return biEncoderPromise;
}

interface CrossEncoder {
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
}

let crossEncoderPromise: Promise<CrossEncoder> | null = null;

export function getCrossEncoder(): Promise<CrossEncoder> {
  if (!crossEncoderPromise) {
    crossEncoderPromise = (async () => {
      const [tokenizer, model] = await Promise.all([
        AutoTokenizer.from_pretrained(CROSS_ENCODER_MODEL),
        AutoModelForSequenceClassification.from_pretrained(CROSS_ENCODER_MODEL),
      ]);
      return { tokenizer, model };
    })();
  }
  return crossEncoderPromise;
}
