import type {
  ClassificationResult,
  ExtractionResult,
  LanguageResult,
  RecommendationResult,
  RiskResult,
  ValidationResultAI,
} from "./schemas";
import type { DocumentType } from "../types";

// Deterministic, heuristic stand-ins for the Gemini agents. Used when no API
// key is configured (or FORCE_MOCK=1). They run real regex/keyword analysis on
// the OCR text, so the offline path produces meaningful — not random — output.

const KNOWN_AUTHORITIES = [
  "bundesagentur für arbeit",
  "ausländerbehörde",
  "auslanderbehorde",
  "bundesamt für migration",
  "home office",
  "immigration",
  "migration",
  "ministero dell'interno",
  "préfecture",
  "prefecture",
];

const TYPE_KEYWORDS: { type: DocumentType; words: string[] }[] = [
  { type: "Residence Permit", words: ["residence permit", "aufenthaltstitel", "aufenthaltserlaubnis", "residence card", "aufenthaltskarte"] },
  { type: "Work Permit", words: ["work permit", "arbeitserlaubnis", "beschäftigungserlaubnis", "work authorization", "permission to work"] },
  { type: "Employment Authorization", words: ["employment authorization", "ead", "arbeitsgenehmigung"] },
  { type: "Visa", words: ["visa", "visum", "schengen"] },
  { type: "Passport", words: ["passport", "reisepass", "passeport"] },
  { type: "National ID", words: ["national id", "identity card", "personalausweis", "carte d'identité"] },
  { type: "Driving License", words: ["driving licence", "driving license", "driver license", "führerschein", "permis de conduire"] },
];

function findDates(text: string): string[] {
  const iso = [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)].map((m) => m[0]);
  const dmy = [...text.matchAll(/\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})\b/g)].map((m) => {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  });
  return [...iso, ...dmy];
}

export function mockClassify(text: string): ClassificationResult {
  const lower = text.toLowerCase();
  for (const { type, words } of TYPE_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) {
      return { document_type: type, classification_confidence: 0.82, reasoning: "Keyword match (heuristic)" };
    }
  }
  if (lower.length < 30) return { document_type: "Unknown", classification_confidence: 0.3 };
  return { document_type: "Other", classification_confidence: 0.45 };
}

export function mockLanguage(text: string): LanguageResult {
  const lower = text.toLowerCase();
  const germanHints = ["und", "der", "die", "arbeit", "aufenthalt", "gültig", "ausländer", "behörde"];
  const isGerman = germanHints.filter((w) => lower.includes(w)).length >= 2;
  return { language: isGerman ? "German" : "English", is_english: !isGerman, english_translation: null };
}

export function mockExtract(text: string): ExtractionResult {
  const lower = text.toLowerCase();
  const dates = findDates(text).sort();
  const permitNo = text.match(/\b([A-Z]{2,3}(?:-[A-Z]{2,4})?-?\d{3,}[-\s]?\d*[A-Z0-9-]*)\b/)?.[1] ?? null;
  // Capture the value after "Name:" up to the next known field label (works on
  // both line-broken and merged single-line OCR/PDF text).
  const FIELD_BOUNDARY =
    "nationality|permit|country|issuing|issue|expiry|document|residence|employer|occupation|visa|date|status";
  const nameMatch =
    text.match(new RegExp(`(?:holder name|inhaber|\\bname|\\bnom)\\s*[:\\-]\\s*(.*?)\\s*(?:\\b(?:${FIELD_BOUNDARY})\\b|$)`, "i"))?.[1]?.trim() ||
    null;
  const authority = KNOWN_AUTHORITIES.find((a) => lower.includes(a)) ?? null;

  return {
    holder_name: nameMatch,
    nationality: null,
    permit_number: permitNo,
    permit_type: null,
    country: lower.includes("germany") || lower.includes("deutschland") ? "Germany" : null,
    issuing_authority: authority ? authority.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
    issue_date: dates[0] ?? null,
    expiry_date: dates.length > 1 ? dates[dates.length - 1] : null,
    document_number: null,
    employer_restrictions: null,
    occupation_restrictions: null,
    visa_category: null,
    residence_status: lower.includes("authorized to work") || lower.includes("berechtigt") ? "Authorized to work" : null,
    notes: null,
  };
}

export function mockValidate(fields: ExtractionResult, ocrConfidence: number): ValidationResultAI {
  const present = (v: unknown) => v != null && String(v).trim().length > 0;
  const required = [fields.holder_name, fields.permit_number, fields.issuing_authority, fields.expiry_date];
  const fields_complete = required.every(present);
  const expiry_present = present(fields.expiry_date);
  const authority_recognized = present(fields.issuing_authority);
  const tampering: string[] = [];

  if (present(fields.issue_date) && present(fields.expiry_date)) {
    if (new Date(fields.expiry_date as string) < new Date(fields.issue_date as string)) {
      tampering.push("Expiry date precedes issue date");
    }
  }
  if (ocrConfidence < 0.6) tampering.push("Low OCR confidence");

  let status: ValidationResultAI["validation_status"] = "Valid";
  if (tampering.length) status = "Possibly Invalid";
  else if (!fields_complete || !authority_recognized) status = "Needs Review";

  const reasons: string[] = [];
  if (authority_recognized) reasons.push("Issuing authority present");
  else reasons.push("Issuing authority not found");
  if (expiry_present) reasons.push("Expiry date present");
  else reasons.push("Expiry date missing");
  if (fields_complete) reasons.push("Required fields present");
  else reasons.push("Some required fields missing");
  reasons.push(...tampering);

  return {
    validation_status: status,
    fields_complete,
    expiry_present,
    authority_recognized,
    format_matches: ocrConfidence >= 0.6 && fields_complete,
    tampering_indicators: tampering,
    reasons,
  };
}

export function mockRisk(validation: ValidationResultAI, ocrConfidence: number): RiskResult {
  let score = 10;
  const anomalies: string[] = [];
  if (validation.tampering_indicators.length) {
    score += 40 * validation.tampering_indicators.length;
    anomalies.push(...validation.tampering_indicators);
  }
  if (!validation.authority_recognized) {
    score += 20;
    anomalies.push("Unrecognized or missing issuing authority");
  }
  if (!validation.fields_complete) {
    score += 15;
    anomalies.push("Incomplete fields");
  }
  if (ocrConfidence < 0.6) {
    score += 15;
    anomalies.push("Low-quality scan");
  }
  return { risk_score: Math.max(0, Math.min(100, score)), anomalies, confidence: ocrConfidence };
}

export function mockRecommend(args: {
  validationStatus: string;
  riskScore: number;
  expired: boolean;
  fieldsComplete: boolean;
}): RecommendationResult {
  const reasons: string[] = [];
  let recommendation: RecommendationResult["recommendation"] = "Likely Valid";
  let requires = false;

  if (args.validationStatus === "Unknown") {
    recommendation = "Unable to Verify";
    requires = true;
    reasons.push("Document type or content could not be confirmed");
  } else if (args.riskScore >= 67 || args.validationStatus === "Possibly Invalid") {
    recommendation = "Needs Human Review";
    requires = true;
    reasons.push("Elevated authenticity risk or validation concerns");
  } else if (!args.fieldsComplete) {
    recommendation = "Document Incomplete";
    requires = true;
    reasons.push("Required fields are missing");
  } else if (args.expired) {
    recommendation = "Needs Human Review";
    requires = true;
    reasons.push("Document is expired");
  } else {
    recommendation = "Likely Valid";
    reasons.push("Recognized authority, complete fields, low risk");
  }

  const confidence = Math.max(0.3, Math.min(0.97, 1 - args.riskScore / 130));
  return { recommendation, reasons, requires_human_review: requires, confidence };
}
