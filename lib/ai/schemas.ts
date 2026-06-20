import { z } from "zod";

// Structured-output contracts for each AI agent. Outputs are validated against
// these with zod.safeParse — a hard hallucination/format guard. Anything that
// fails validation is rejected and the agent falls back to a safe default.

export const DOCUMENT_TYPES = [
  "Work Permit",
  "Residence Permit",
  "Visa",
  "Passport",
  "National ID",
  "Driving License",
  "Employment Authorization",
  "Residence Card",
  "Other",
  "Unknown",
] as const;

export const VALIDATION_STATUSES = ["Valid", "Needs Review", "Possibly Invalid", "Unknown"] as const;

export const RECOMMENDATIONS = [
  "Likely Valid",
  "Likely Invalid",
  "Needs Human Review",
  "Document Incomplete",
  "Unable to Verify",
] as const;

// A string field that the model may legitimately not find. We accept null and
// normalize empty strings to null downstream (no invented values).
const nullableStr = z.string().nullable().optional();

export const ClassificationSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  classification_confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});
export type ClassificationResult = z.infer<typeof ClassificationSchema>;

export const LanguageSchema = z.object({
  language: z.string(),
  is_english: z.boolean(),
  english_translation: z.string().nullable().optional(),
});
export type LanguageResult = z.infer<typeof LanguageSchema>;

export const ExtractionSchema = z.object({
  holder_name: nullableStr,
  nationality: nullableStr,
  permit_number: nullableStr,
  permit_type: nullableStr,
  country: nullableStr,
  issuing_authority: nullableStr,
  issue_date: nullableStr,
  expiry_date: nullableStr,
  document_number: nullableStr,
  employer_restrictions: nullableStr,
  occupation_restrictions: nullableStr,
  visa_category: nullableStr,
  residence_status: nullableStr,
  notes: nullableStr,
});
export type ExtractionResult = z.infer<typeof ExtractionSchema>;

export const ValidationSchema = z.object({
  validation_status: z.enum(VALIDATION_STATUSES),
  fields_complete: z.boolean(),
  expiry_present: z.boolean(),
  authority_recognized: z.boolean(),
  format_matches: z.boolean(),
  tampering_indicators: z.array(z.string()),
  reasons: z.array(z.string()),
});
export type ValidationResultAI = z.infer<typeof ValidationSchema>;

export const RiskSchema = z.object({
  risk_score: z.number().min(0).max(100),
  anomalies: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type RiskResult = z.infer<typeof RiskSchema>;

export const RecommendationSchema = z.object({
  recommendation: z.enum(RECOMMENDATIONS),
  reasons: z.array(z.string()),
  requires_human_review: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type RecommendationResult = z.infer<typeof RecommendationSchema>;
