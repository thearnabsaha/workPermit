import { DOCUMENT_TYPES, VALIDATION_STATUSES, RECOMMENDATIONS } from "./schemas";

// Prompt builders for each agent. All prompts:
//  - demand JSON-only output (parsed + zod-validated by the caller),
//  - forbid inventing data ("use null when not present"),
//  - keep chain-of-thought internal (only the allowed fields are returned).

const JSON_RULES = `You must respond with a SINGLE valid JSON object and nothing else.
Do not wrap it in markdown code fences. Do not add commentary before or after.
Never invent information. If a value is not clearly present in the document, use null.
Do not output your private reasoning; only output the requested JSON fields.`;

export const SYSTEM_BASE = `You are a meticulous document-intelligence assistant for an HR work-permit review team.
You assist human reviewers; you never make final legal or hiring decisions.
You are careful, conservative, and explicit about uncertainty.`;

function truncate(text: string, max = 12000): string {
  return text.length > max ? text.slice(0, max) + "\n...[truncated]" : text;
}

export function classificationPrompt(ocrText: string): string {
  return `${JSON_RULES}

Classify the document below into exactly one of these types:
${DOCUMENT_TYPES.map((t) => `- ${t}`).join("\n")}

Return JSON: { "document_type": <one of the above>, "classification_confidence": <0..1>, "reasoning": <short, optional> }

DOCUMENT TEXT (from OCR, may contain noise):
"""
${truncate(ocrText)}
"""`;
}

export function languagePrompt(ocrText: string): string {
  return `${JSON_RULES}

Detect the primary language of the document text. If it is not English, provide a faithful English translation of the key content (names, authority, dates, statuses).

Return JSON: { "language": <language name in English, e.g. "German">, "is_english": <bool>, "english_translation": <string or null> }

DOCUMENT TEXT:
"""
${truncate(ocrText, 8000)}
"""`;
}

export function extractionPrompt(ocrText: string): string {
  return `${JSON_RULES}

Extract the following fields from this permit/identity document. Use null for any field not clearly present. Keep dates in ISO format (YYYY-MM-DD) when possible; otherwise copy them verbatim.

Return JSON with exactly these keys:
{
  "holder_name", "nationality", "permit_number", "permit_type", "country",
  "issuing_authority", "issue_date", "expiry_date", "document_number",
  "employer_restrictions", "occupation_restrictions", "visa_category",
  "residence_status", "notes"
}

DOCUMENT TEXT:
"""
${truncate(ocrText)}
"""`;
}

export function validationPrompt(args: {
  documentType: string;
  fields: Record<string, unknown>;
  ocrConfidence: number;
}): string {
  return `${JSON_RULES}

Assess whether this ${args.documentType} appears genuine and complete. Consider: required fields present, expiry date present, issuing authority recognized for the country, format matches expected patterns, OCR confidence acceptable, and any tampering/inconsistency indicators (e.g. expiry before issue date, impossible dates).

OCR confidence: ${(args.ocrConfidence * 100).toFixed(0)}%
Extracted fields: ${JSON.stringify(args.fields)}

Choose validation_status from: ${VALIDATION_STATUSES.join(", ")}.
Never assert a final legal determination — when uncertain, prefer "Needs Review".

Return JSON: {
  "validation_status", "fields_complete": <bool>, "expiry_present": <bool>,
  "authority_recognized": <bool>, "format_matches": <bool>,
  "tampering_indicators": <string[]>, "reasons": <string[]>
}`;
}

export function riskPrompt(args: {
  documentType: string;
  fields: Record<string, unknown>;
  ocrConfidence: number;
  validationReasons: string[];
}): string {
  return `${JSON_RULES}

Produce an authenticity RISK assessment (0 = no risk, 100 = very high risk) for this ${args.documentType}.
Weigh: edited/tampered indicators, low-quality scan, missing pages/fields, unusual fonts/formatting, inconsistent dates, missing signatures/authority, suspicious OCR output.

OCR confidence: ${(args.ocrConfidence * 100).toFixed(0)}%
Validation notes: ${JSON.stringify(args.validationReasons)}
Extracted fields: ${JSON.stringify(args.fields)}

Return JSON: { "risk_score": <0..100>, "anomalies": <string[]>, "confidence": <0..1> }`;
}

export function recommendationPrompt(args: {
  documentType: string;
  validationStatus: string;
  riskScore: number;
  expired: boolean;
  fieldsComplete: boolean;
  reasons: string[];
}): string {
  return `${JSON_RULES}

Based on the analysis, produce an HR recommendation. You assist the reviewer; you do NOT make the final decision.

Choose recommendation from: ${RECOMMENDATIONS.join(", ")}.
Set requires_human_review=true whenever there is meaningful uncertainty, elevated risk, an expired document, or incompleteness.

Inputs:
- document_type: ${args.documentType}
- validation_status: ${args.validationStatus}
- risk_score (0..100): ${args.riskScore}
- expired: ${args.expired}
- fields_complete: ${args.fieldsComplete}
- prior reasons: ${JSON.stringify(args.reasons)}

Return JSON: { "recommendation", "reasons": <string[]>, "requires_human_review": <bool>, "confidence": <0..1> }`;
}
