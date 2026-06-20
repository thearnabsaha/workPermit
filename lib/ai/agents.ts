import { generateStructured } from "./gemini";
import {
  ClassificationSchema,
  ExtractionSchema,
  LanguageSchema,
  RecommendationSchema,
  RiskSchema,
  ValidationSchema,
  type ClassificationResult,
  type ExtractionResult,
  type LanguageResult,
  type RecommendationResult,
  type RiskResult,
  type ValidationResultAI,
} from "./schemas";
import {
  SYSTEM_BASE,
  classificationPrompt,
  extractionPrompt,
  languagePrompt,
  recommendationPrompt,
  riskPrompt,
  validationPrompt,
} from "./prompts";
import { mockClassify, mockExtract, mockLanguage, mockRecommend, mockRisk, mockValidate } from "./mock";
import { hasGemini } from "../config";
import { logger } from "../logger";

// Each function is the "hybrid" boundary: it uses Gemini when a key is present
// and the deterministic heuristic otherwise. Gemini failures (network, schema)
// fall back to the mock so the pipeline never hard-fails.

async function withFallback<T>(label: string, real: () => Promise<T>, mock: () => T): Promise<{ value: T; usedAi: boolean }> {
  if (!hasGemini()) return { value: mock(), usedAi: false };
  try {
    return { value: await real(), usedAi: true };
  } catch (err) {
    logger.warn("agent.fallback", { label, error: (err as Error).message });
    return { value: mock(), usedAi: false };
  }
}

export function classifyDocument(text: string, images?: string[]) {
  return withFallback<ClassificationResult>(
    "classify",
    () =>
      generateStructured({
        system: SYSTEM_BASE,
        user: classificationPrompt(text),
        schema: ClassificationSchema,
        images,
      }),
    () => mockClassify(text)
  );
}

export function detectLanguage(text: string) {
  return withFallback<LanguageResult>(
    "language",
    () => generateStructured({ system: SYSTEM_BASE, user: languagePrompt(text), schema: LanguageSchema }),
    () => mockLanguage(text)
  );
}

export function extractFields(text: string, images?: string[]) {
  return withFallback<ExtractionResult>(
    "extract",
    () => generateStructured({ system: SYSTEM_BASE, user: extractionPrompt(text), schema: ExtractionSchema, images }),
    () => mockExtract(text)
  );
}

export function validateDocument(args: {
  documentType: string;
  fields: ExtractionResult;
  ocrConfidence: number;
}) {
  return withFallback<ValidationResultAI>(
    "validate",
    () =>
      generateStructured({
        system: SYSTEM_BASE,
        user: validationPrompt({ documentType: args.documentType, fields: args.fields, ocrConfidence: args.ocrConfidence }),
        schema: ValidationSchema,
      }),
    () => mockValidate(args.fields, args.ocrConfidence)
  );
}

export function assessRisk(args: {
  documentType: string;
  fields: ExtractionResult;
  ocrConfidence: number;
  validation: ValidationResultAI;
  images?: string[];
}) {
  return withFallback<RiskResult>(
    "risk",
    () =>
      generateStructured({
        system: SYSTEM_BASE,
        user: riskPrompt({
          documentType: args.documentType,
          fields: args.fields,
          ocrConfidence: args.ocrConfidence,
          validationReasons: args.validation.reasons,
        }),
        schema: RiskSchema,
        images: args.images,
      }),
    () => mockRisk(args.validation, args.ocrConfidence)
  );
}

export function recommendDecision(args: {
  documentType: string;
  validationStatus: string;
  riskScore: number;
  expired: boolean;
  fieldsComplete: boolean;
  reasons: string[];
}) {
  return withFallback<RecommendationResult>(
    "recommend",
    () =>
      generateStructured({
        system: SYSTEM_BASE,
        user: recommendationPrompt(args),
        schema: RecommendationSchema,
      }),
    () =>
      mockRecommend({
        validationStatus: args.validationStatus,
        riskScore: args.riskScore,
        expired: args.expired,
        fieldsComplete: args.fieldsComplete,
      })
  );
}
