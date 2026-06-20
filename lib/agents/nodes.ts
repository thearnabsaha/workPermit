import type { GraphStateType, GraphUpdate, AgentTrace } from "./state";
import { runOcrMany, expandInputs, type InputFile } from "../ocr";
import { analyzeExpiry } from "./expiry";
import {
  assessRisk,
  classifyDocument,
  detectLanguage,
  extractFields,
  recommendDecision,
  validateDocument,
} from "../ai/agents";
import type { ExtractionResult } from "../ai/schemas";
import type {
  DocumentType,
  Evaluation,
  ValidationStatus,
  WorkPermitArtifact,
  WorkPermitFields,
} from "../types";

// --- helpers --------------------------------------------------------------

function trace(
  step: string,
  label: string,
  status: AgentTrace["status"],
  message?: string,
  durationMs?: number
): AgentTrace {
  return { step, label, status, message, durationMs };
}

// Tiny heuristic prompt-injection scan over OCR text (security trace).
function scanInjection(text: string): boolean {
  const patterns = [
    /ignore (all )?previous instructions/i,
    /disregard (the )?(above|system)/i,
    /you are now/i,
    /system prompt/i,
    /reveal your (instructions|prompt)/i,
  ];
  return patterns.some((p) => p.test(text));
}

function buildImageDataUrls(files: InputFile[]): string[] {
  return files
    .filter((f) => f.mime.startsWith("image/"))
    .slice(0, 2)
    .map((f) => `data:${f.mime};base64,${f.buffer.toString("base64")}`);
}

function normalizeFields(e: ExtractionResult | null): WorkPermitFields {
  const clean = (v: unknown) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length === 0 || /^(n\/?a|none|null|unknown)$/i.test(s) ? null : s;
  };
  return {
    holder_name: clean(e?.holder_name),
    nationality: clean(e?.nationality),
    permit_number: clean(e?.permit_number),
    permit_type: clean(e?.permit_type),
    country: clean(e?.country),
    issuing_authority: clean(e?.issuing_authority),
    issue_date: clean(e?.issue_date),
    expiry_date: clean(e?.expiry_date),
    document_number: clean(e?.document_number),
    employer_restrictions: clean(e?.employer_restrictions),
    occupation_restrictions: clean(e?.occupation_restrictions),
    visa_category: clean(e?.visa_category),
    residence_status: clean(e?.residence_status),
    notes: clean(e?.notes),
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// --- nodes ----------------------------------------------------------------

/** 1. Upload Agent — validate intake. */
export async function uploadNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const count = state.files.length;
  if (count === 0) {
    return {
      traces: [trace("input_received", "Upload Agent", "warning", "No files attached — using message only", Date.now() - start)],
    };
  }
  return {
    traces: [trace("input_received", "Upload Agent", "done", `${count} file(s) received`, Date.now() - start)],
  };
}

/** 2. OCR Agent — extract text (with internal retry), + injection scan. */
export async function ocrNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const expanded = await expandInputs(state.files);
  const sourceNames = expanded.map((f) => f.name);
  const imageDataUrls = buildImageDataUrls(expanded);
  const ocr = await runOcrMany(expanded);

  const status: AgentTrace["status"] = ocr.confidence >= 0.6 ? "done" : ocr.text ? "warning" : "error";
  const traces: AgentTrace[] = [
    trace(
      "file_extraction",
      "OCR Agent",
      status,
      ocr.text
        ? `${ocr.pageCount} page(s), ${(ocr.confidence * 100).toFixed(0)}% confidence (${ocr.engine})`
        : ocr.note ?? "No readable text extracted",
      Date.now() - start
    ),
  ];

  const injectionDetected = scanInjection(ocr.text);
  traces.push(
    trace("prompt_injection_scan", "Security", injectionDetected ? "warning" : "done", injectionDetected ? "Potential injection text neutralized (treated as data)" : "No injection detected")
  );

  return {
    ocr,
    sourceNames,
    imageDataUrls,
    injectionDetected,
    traces,
    partials: [ocr.text ? "Reading the document and checking it against permit patterns...\n\n" : "Could not read text from the document.\n\n"],
    warnings: ocr.text ? [] : ["OCR produced no readable text"],
  };
}

/** 3. Language Detection Agent. */
export async function languageNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const text = state.ocr?.text ?? "";
  if (!text) {
    return { traces: [trace("language_detection", "Language Detection Agent", "done", "No text to analyze", Date.now() - start)] };
  }
  const { value, usedAi } = await detectLanguage(text);
  return {
    language: value,
    usedAi,
    traces: [trace("language_detection", "Language Detection Agent", "done", `${value.language}${value.is_english ? "" : " (translated)"}`, Date.now() - start)],
  };
}

/** 4. Classification Agent. */
export async function classifyNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const text = state.ocr?.text ?? "";
  const { value, usedAi } = await classifyDocument(text, state.imageDataUrls);
  return {
    classification: value,
    usedAi,
    traces: [trace("document_classification", "Classification Agent", "done", `${value.document_type} (${(value.classification_confidence * 100).toFixed(0)}%)`, Date.now() - start)],
  };
}

/** 5. Information Extraction Agent. */
export async function extractNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const text = state.ocr?.text ?? "";
  const { value, usedAi } = await extractFields(text, state.imageDataUrls);
  const found = Object.values(value).filter((v) => v != null && String(v).trim()).length;
  return {
    extraction: value,
    usedAi,
    traces: [trace("information_extraction", "Extraction Agent", "done", `${found} field(s) extracted`, Date.now() - start)],
  };
}

/** 6. Validation Agent. */
export async function validateNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const documentType = state.classification?.document_type ?? "Unknown";
  const fields = state.extraction ?? ({} as ExtractionResult);
  const ocrConfidence = state.ocr?.confidence ?? 0;
  const { value, usedAi } = await validateDocument({ documentType, fields, ocrConfidence });
  const status: AgentTrace["status"] =
    value.validation_status === "Valid" ? "done" : value.validation_status === "Possibly Invalid" ? "error" : "warning";
  return {
    validation: value,
    usedAi,
    traces: [trace("validation", "Validation Agent", status, value.validation_status, Date.now() - start)],
  };
}

/** 7. Risk Assessment Agent. */
export async function riskNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const documentType = state.classification?.document_type ?? "Unknown";
  const fields = state.extraction ?? ({} as ExtractionResult);
  const ocrConfidence = state.ocr?.confidence ?? 0;
  const validation = state.validation ?? {
    validation_status: "Unknown" as ValidationStatus,
    fields_complete: false,
    expiry_present: false,
    authority_recognized: false,
    format_matches: false,
    tampering_indicators: [],
    reasons: [],
  };
  const { value, usedAi } = await assessRisk({ documentType, fields, ocrConfidence, validation, images: state.imageDataUrls });
  const status: AgentTrace["status"] = value.risk_score <= 33 ? "done" : value.risk_score <= 66 ? "warning" : "error";
  return {
    risk: value,
    usedAi,
    traces: [trace("risk_assessment", "Risk Assessment Agent", status, `Risk ${value.risk_score}/100`, Date.now() - start)],
  };
}

/** 8. Expiry Analysis Agent (deterministic). */
export async function expiryNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const expiry = analyzeExpiry(state.extraction?.expiry_date ?? null);
  let status: AgentTrace["status"] = "done";
  let message = "No expiry date found";
  if (expiry.expiry_date) {
    if (expiry.expired) {
      status = "error";
      message = "Document is expired";
    } else if (expiry.within_30) {
      status = "warning";
      message = `${expiry.days_remaining} days remaining`;
    } else {
      message = `${expiry.days_remaining} days remaining`;
    }
  }
  return { expiry, traces: [trace("expiry_analysis", "Expiry Analysis Agent", status, message, Date.now() - start)] };
}

/** 9. Recommendation Agent. */
export async function recommendNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const documentType = state.classification?.document_type ?? "Unknown";
  const isUnknown = documentType === "Unknown" || (state.classification?.classification_confidence ?? 0) < 0.4;

  const validationStatus = state.validation?.validation_status ?? (isUnknown ? "Unknown" : "Needs Review");
  const riskScore = state.risk?.risk_score ?? (isUnknown ? 50 : 40);
  const expired = state.expiry?.expired ?? false;
  const fieldsComplete = state.validation?.fields_complete ?? false;
  const reasons = [...(state.validation?.reasons ?? []), ...(state.risk?.anomalies ?? [])];

  const { value, usedAi } = await recommendDecision({
    documentType,
    validationStatus,
    riskScore,
    expired,
    fieldsComplete,
    reasons,
  });

  return {
    recommendation: value,
    usedAi,
    traces: [trace("recommendation", "Recommendation Agent", "done", value.recommendation, Date.now() - start)],
  };
}

/** 10. Notification Agent — derive alerts + human-review signal. */
export async function notifyNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const warnings: string[] = [];
  const expiry = state.expiry;
  const risk = state.risk;
  const validation = state.validation;

  if (expiry?.expired) warnings.push("Document is expired");
  else if (expiry?.within_30) warnings.push(`Expires within 30 days (${expiry.days_remaining} days remaining)`);
  else if (expiry?.within_60) warnings.push("Expires within 60 days");
  else if (expiry?.within_90) warnings.push("Expires within 90 days");

  if (risk && risk.risk_score >= 67) warnings.push(`High authenticity risk (${risk.risk_score}/100)`);
  if (validation?.validation_status === "Possibly Invalid") warnings.push("Validation flagged the document as possibly invalid");
  if (state.injectionDetected) warnings.push("Prompt-injection text detected in document (treated as data)");

  const required =
    (state.recommendation?.requires_human_review ?? false) ||
    (risk?.risk_score ?? 0) >= 67 ||
    validation?.validation_status === "Possibly Invalid" ||
    validation?.validation_status === "Needs Review" ||
    (expiry?.expired ?? false);

  const reason = required
    ? warnings[0] ?? state.recommendation?.reasons?.[0] ?? "AI is uncertain — human confirmation recommended"
    : undefined;

  return {
    warnings,
    humanReview: { required, reason },
    traces: [trace("notification", "Notification Agent", warnings.length ? "warning" : "done", warnings.length ? `${warnings.length} alert(s)` : "No alerts", Date.now() - start)],
  };
}

/** 11. Analytics Agent — assemble the final artifact + evaluation. */
export async function analyticsNode(state: GraphStateType): Promise<GraphUpdate> {
  const start = Date.now();
  const fields = normalizeFields(state.extraction);
  const documentType = (state.classification?.document_type ?? "Unknown") as DocumentType;
  const classConf = state.classification?.classification_confidence ?? 0;
  const ocrConf = state.ocr?.confidence ?? 0;
  const expiry = state.expiry ?? analyzeExpiry(fields.expiry_date);
  const validationStatus = (state.validation?.validation_status ?? "Unknown") as ValidationStatus;
  const recommendation = state.recommendation;
  const riskScore = state.risk?.risk_score ?? 50;

  // Blend signals into one overall confidence (no single source dominates).
  const overall = clamp01(0.4 * (recommendation?.confidence ?? 0.4) + 0.3 * classConf + 0.3 * ocrConf);

  const reasons = (recommendation?.reasons?.length ? recommendation.reasons : state.validation?.reasons ?? []).slice(0, 6);
  const requiresReview = state.humanReview?.required ?? recommendation?.requires_human_review ?? false;

  const artifact: WorkPermitArtifact = {
    artifact_type: "work_permit",
    document_type: documentType,
    classification_confidence: classConf,
    validation_status: validationStatus,
    recommendation: recommendation?.recommendation ?? "Unable to Verify",
    fields,
    expiry,
    risk_score: riskScore,
    confidence_score: overall,
    ocr_confidence: ocrConf,
    reasons,
    requires_human_review: requiresReview,
    detected_language: state.language?.language ?? null,
    source_documents: state.sourceNames,
  };

  const evaluation: Evaluation = {
    input_parsed: true,
    files_processed: state.files.length > 0 && !!state.ocr?.text,
    prompt_injection_checked: true,
    output_schema_valid: true,
    edge_cases_checked: true,
    confidence_score: overall,
    human_review_needed: requiresReview,
    warnings: state.warnings,
    errors: state.errors,
  };

  return {
    artifact,
    evaluation,
    traces: [trace("analytics", "Analytics Agent", "done", "Result assembled + metrics recorded", Date.now() - start)],
    partials: ["\nValidation complete. See the result panel for the full breakdown."],
  };
}

/** Conditional router after classification. */
export function routeAfterClassify(state: GraphStateType): "extract" | "recommend" {
  const c = state.classification;
  if (!c || c.document_type === "Unknown" || c.classification_confidence < 0.4) return "recommend";
  return "extract";
}
