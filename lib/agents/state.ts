import { Annotation } from "@langchain/langgraph";
import type { InputFile, OcrResult } from "../ocr";
import type {
  ClassificationResult,
  ExtractionResult,
  LanguageResult,
  RecommendationResult,
  RiskResult,
  ValidationResultAI,
} from "../ai/schemas";
import type { ExpiryAnalysis, WorkPermitArtifact, Evaluation } from "../types";

// A safe workflow audit step (NOT chain-of-thought). Streamed to the UI trace.
export interface AgentTrace {
  step: string;
  label: string;
  status: "running" | "done" | "warning" | "error";
  message?: string;
  durationMs?: number;
  details?: string;
}

export interface HumanReviewSignal {
  required: boolean;
  reason?: string;
}

// Channels that simply hold the latest value.
function last<T>(initial: () => T) {
  return Annotation<T>({ reducer: (_prev: T, next: T) => next, default: initial });
}
// Channels that accumulate across nodes.
function concat<T>() {
  return Annotation<T[]>({ reducer: (prev: T[], next: T[]) => prev.concat(next ?? []), default: () => [] });
}

export const GraphState = Annotation.Root({
  // Inputs
  files: last<InputFile[]>(() => []),
  message: last<string>(() => ""),
  imageDataUrls: last<string[]>(() => []),
  sourceNames: last<string[]>(() => []),

  // Per-agent results
  ocr: last<OcrResult | null>(() => null),
  language: last<LanguageResult | null>(() => null),
  classification: last<ClassificationResult | null>(() => null),
  extraction: last<ExtractionResult | null>(() => null),
  validation: last<ValidationResultAI | null>(() => null),
  risk: last<RiskResult | null>(() => null),
  expiry: last<ExpiryAnalysis | null>(() => null),
  recommendation: last<RecommendationResult | null>(() => null),

  // Final assembled outputs
  artifact: last<WorkPermitArtifact | null>(() => null),
  evaluation: last<Evaluation | null>(() => null),
  humanReview: last<HumanReviewSignal | null>(() => null),

  // Bookkeeping
  usedAi: Annotation<boolean>({ reducer: (a: boolean, b: boolean) => a || b, default: () => false }),
  injectionDetected: last<boolean>(() => false),

  // Accumulators streamed to the UI
  traces: concat<AgentTrace>(),
  partials: concat<string>(),
  warnings: concat<string>(),
  errors: concat<string>(),
});

export type GraphStateType = typeof GraphState.State;
export type GraphUpdate = Partial<GraphStateType>;
