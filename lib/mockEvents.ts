import type { StreamEvent } from "./types";

export interface DemoScenario {
  id: string;
  title: string;
  description: string;
  sampleInput: string;
  file: { name: string; type: string; size: number }; // fake file chip
  events: StreamEvent[];
}

// Builds the 11-agent workflow trace (safe audit log — never chain-of-thought).
// `tail` lets a scenario tweak the validation/risk wording per case.
function agentTrace(opts: {
  fileName: string;
  docType: string;
  classConf: number;
  validation: { status: "done" | "warning" | "error"; message: string };
  risk: { status: "done" | "warning" | "error"; message: string };
}): StreamEvent[] {
  return [
    { type: "trace", step: "input_received", status: "done", label: "Upload Agent", message: "Request received", durationMs: 30 },
    { type: "trace", step: "file_extraction", status: "running", label: "OCR Agent", message: `Reading ${opts.fileName}...` },
    { type: "trace", step: "file_extraction", status: "done", label: "OCR Agent", message: "Text extracted (deskew + denoise applied)", durationMs: 1400 },
    { type: "trace", step: "language_detection", status: "done", label: "Language Detection Agent", message: "Language detected", durationMs: 120 },
    { type: "trace", step: "document_classification", status: "done", label: "Classification Agent", message: `${opts.docType} (${(opts.classConf * 100).toFixed(0)}%)`, durationMs: 380 },
    { type: "trace", step: "information_extraction", status: "running", label: "Extraction Agent", message: "Extracting structured fields..." },
    { type: "trace", step: "information_extraction", status: "done", label: "Extraction Agent", message: "Fields extracted + schema-validated", durationMs: 900 },
    { type: "trace", step: "validation", status: opts.validation.status, label: "Validation Agent", message: opts.validation.message, durationMs: 260 },
    { type: "trace", step: "risk_assessment", status: opts.risk.status, label: "Risk Assessment Agent", message: opts.risk.message, durationMs: 320 },
    { type: "trace", step: "expiry_analysis", status: "done", label: "Expiry Analysis Agent", message: "Validity window computed", durationMs: 40 },
    { type: "trace", step: "recommendation", status: "done", label: "Recommendation Agent", message: "HR recommendation generated", durationMs: 200 },
    { type: "trace", step: "notification", status: "done", label: "Notification Agent", message: "Alerts evaluated", durationMs: 30 },
    { type: "trace", step: "analytics", status: "done", label: "Analytics Agent", message: "Metrics recorded", durationMs: 25 },
  ];
}

// ---- Primary offline fallback -------------------------------------------
// Used for any free-typed message when the backend is unreachable. Produces a
// real work_permit artifact so the demo is meaningful even with no backend.
export const genericEvents: StreamEvent[] = [
  ...agentTrace({
    fileName: "uploaded document",
    docType: "Work Permit",
    classConf: 0.94,
    validation: { status: "done", message: "All required fields present" },
    risk: { status: "done", message: "No tampering indicators" },
  }),
  { type: "partial", content: "Reviewing the document against work-permit patterns...\n\n" },
  { type: "partial", content: "Extracted the key fields and checked expiry and issuing authority." },
  {
    type: "artifact",
    artifact_type: "work_permit",
    data: {
      document_type: "Work Permit",
      classification_confidence: 0.94,
      validation_status: "Valid",
      recommendation: "Likely Valid",
      fields: {
        holder_name: "Maria Santos",
        nationality: "Brazilian",
        permit_number: "DE-WP-2024-558102",
        permit_type: "General employment",
        country: "Germany",
        issuing_authority: "Bundesagentur für Arbeit",
        issue_date: "2024-03-15",
        expiry_date: "2027-03-14",
        document_number: "ABC123456",
        employer_restrictions: "None",
        occupation_restrictions: "None",
        visa_category: null,
        residence_status: "Authorized to work",
        notes: null,
      },
      expiry: { expiry_date: "2027-03-14", days_remaining: 268, expired: false, within_30: false, within_60: false, within_90: false },
      risk_score: 12,
      confidence_score: 0.93,
      ocr_confidence: 0.95,
      reasons: [
        "Recognized issuing authority (Bundesagentur für Arbeit)",
        "Valid, unexpired expiry date",
        "Expected formatting and field completeness",
        "High OCR confidence with no tampering indicators",
      ],
      requires_human_review: false,
      detected_language: "German",
      source_documents: ["uploaded document"],
    },
  },
  {
    type: "evaluation",
    data: {
      input_parsed: true,
      files_processed: true,
      prompt_injection_checked: true,
      output_schema_valid: true,
      edge_cases_checked: true,
      confidence_score: 0.93,
      human_review_needed: false,
    },
  },
  { type: "done" },
];

// ---- Developer samples ---------------------------------------------------
// Accessed via the "Dev samples" menu. Cover the renderer across cases.

export const DEV_SAMPLES: DemoScenario[] = [
  {
    id: "valid_work_permit",
    title: "Valid work permit",
    description: "Genuine German work permit, in date, high confidence.",
    sampleInput: "Validate this work permit and confirm the holder can work.",
    file: { name: "work-permit-maria-santos.pdf", type: "application/pdf", size: 248_320 },
    events: genericEvents,
  },
  {
    id: "expiring_permit",
    title: "Expiring residence permit",
    description: "Valid but expires within 30 days — should warn.",
    sampleInput: "Check this residence permit's validity and remaining time.",
    file: { name: "residence-permit-okafor.jpg", type: "image/jpeg", size: 1_204_500 },
    events: [
      ...agentTrace({
        fileName: "residence-permit-okafor.jpg",
        docType: "Residence Permit",
        classConf: 0.91,
        validation: { status: "warning", message: "Valid but nearing expiry" },
        risk: { status: "done", message: "Low risk; quality acceptable" },
      }),
      { type: "partial", content: "Document is genuine but the validity window is closing.\n\n" },
      {
        type: "artifact",
        artifact_type: "work_permit",
        data: {
          document_type: "Residence Permit",
          classification_confidence: 0.91,
          validation_status: "Valid",
          recommendation: "Likely Valid",
          fields: {
            holder_name: "Chidi Okafor",
            nationality: "Nigerian",
            permit_number: "DE-RP-2022-771043",
            permit_type: "Residence with work authorization",
            country: "Germany",
            issuing_authority: "Ausländerbehörde Saarbrücken",
            issue_date: "2022-07-01",
            expiry_date: "2026-07-12",
            document_number: "RP9981234",
            employer_restrictions: "None",
            occupation_restrictions: "None",
            visa_category: null,
            residence_status: "Authorized to work",
            notes: "Renewal recommended before expiry.",
          },
          expiry: { expiry_date: "2026-07-12", days_remaining: 22, expired: false, within_30: true, within_60: true, within_90: true },
          risk_score: 24,
          confidence_score: 0.88,
          ocr_confidence: 0.86,
          reasons: [
            "Recognized issuing authority (Ausländerbehörde Saarbrücken)",
            "Document appears genuine with expected formatting",
            "Expiry date is within 30 days — renewal should be initiated",
          ],
          requires_human_review: true,
          detected_language: "German",
          source_documents: ["residence-permit-okafor.jpg"],
        },
      },
      {
        type: "evaluation",
        data: {
          input_parsed: true,
          files_processed: true,
          prompt_injection_checked: true,
          output_schema_valid: true,
          edge_cases_checked: true,
          confidence_score: 0.88,
          human_review_needed: true,
          warnings: ["Permit expires within 30 days (22 days remaining)"],
        },
      },
      { type: "human_review", required: true, reason: "Permit expires within 30 days — confirm renewal status." },
      { type: "done" },
    ],
  },
  {
    id: "suspicious_permit",
    title: "Suspicious / possibly fake",
    description: "Inconsistent dates + tampering indicators — flagged for review.",
    sampleInput: "Does this work permit look genuine?",
    file: { name: "permit-scan-lowres.png", type: "image/png", size: 540_000 },
    events: [
      ...agentTrace({
        fileName: "permit-scan-lowres.png",
        docType: "Work Permit",
        classConf: 0.64,
        validation: { status: "error", message: "Inconsistent dates + missing authority" },
        risk: { status: "warning", message: "Possible editing detected" },
      }),
      { type: "partial", content: "Several inconsistencies were detected. This needs a human reviewer.\n\n" },
      {
        type: "artifact",
        artifact_type: "work_permit",
        data: {
          document_type: "Work Permit",
          classification_confidence: 0.64,
          validation_status: "Possibly Invalid",
          recommendation: "Needs Human Review",
          fields: {
            holder_name: "Ivan Petrov",
            nationality: "Unknown",
            permit_number: "WP-00-000",
            permit_type: null,
            country: "Germany",
            issuing_authority: null,
            issue_date: "2025-12-01",
            expiry_date: "2024-11-30",
            document_number: null,
            employer_restrictions: null,
            occupation_restrictions: null,
            visa_category: null,
            residence_status: null,
            notes: "Expiry date precedes issue date.",
          },
          expiry: { expiry_date: "2024-11-30", days_remaining: -540, expired: true, within_30: false, within_60: false, within_90: false },
          risk_score: 82,
          confidence_score: 0.41,
          ocr_confidence: 0.55,
          reasons: [
            "Expiry date precedes the issue date (inconsistent)",
            "Issuing authority not found / not recognized",
            "Low OCR confidence and possible font/formatting irregularities",
            "Several required fields are missing",
          ],
          requires_human_review: true,
          detected_language: "English",
          source_documents: ["permit-scan-lowres.png"],
        },
      },
      {
        type: "evaluation",
        data: {
          input_parsed: true,
          files_processed: true,
          prompt_injection_checked: true,
          output_schema_valid: true,
          edge_cases_checked: true,
          confidence_score: 0.41,
          human_review_needed: true,
          warnings: ["Inconsistent dates", "Unrecognized issuing authority", "Low OCR confidence (0.55)"],
        },
      },
      { type: "human_review", required: true, reason: "Tampering indicators and inconsistent dates detected." },
      { type: "done" },
    ],
  },
  {
    id: "unknown_document",
    title: "Unknown document",
    description: "Not a recognizable permit — low classification confidence.",
    sampleInput: "Is this a work permit?",
    file: { name: "scanned-letter.pdf", type: "application/pdf", size: 88_000 },
    events: [
      ...agentTrace({
        fileName: "scanned-letter.pdf",
        docType: "Unknown",
        classConf: 0.38,
        validation: { status: "warning", message: "Could not confirm document type" },
        risk: { status: "done", message: "Not applicable — type unknown" },
      }),
      { type: "partial", content: "This does not match the patterns of a known permit or ID document.\n\n" },
      {
        type: "artifact",
        artifact_type: "work_permit",
        data: {
          document_type: "Unknown",
          classification_confidence: 0.38,
          validation_status: "Unknown",
          recommendation: "Unable to Verify",
          fields: {
            holder_name: null, nationality: null, permit_number: null, permit_type: null,
            country: null, issuing_authority: null, issue_date: null, expiry_date: null,
            document_number: null, employer_restrictions: null, occupation_restrictions: null,
            visa_category: null, residence_status: null, notes: "Document type could not be determined.",
          },
          expiry: { expiry_date: null, days_remaining: null, expired: false, within_30: false, within_60: false, within_90: false },
          risk_score: 50,
          confidence_score: 0.38,
          ocr_confidence: 0.72,
          reasons: [
            "Document does not match known permit/ID layouts",
            "No permit number or issuing authority found",
            "Please upload the actual work or residence permit page",
          ],
          requires_human_review: true,
          detected_language: "German",
          source_documents: ["scanned-letter.pdf"],
        },
      },
      {
        type: "evaluation",
        data: {
          input_parsed: true,
          files_processed: true,
          prompt_injection_checked: true,
          output_schema_valid: true,
          edge_cases_checked: true,
          confidence_score: 0.38,
          human_review_needed: true,
          warnings: ["Document type could not be confidently classified"],
        },
      },
      { type: "human_review", required: true, reason: "Document type unknown — manual classification needed." },
      { type: "done" },
    ],
  },
];

// Yields events with small delays, mimicking a live stream.
export async function* mockEventStream(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const e of events) {
    await new Promise((r) => setTimeout(r, e.type === "partial" ? 220 : 320));
    yield e;
  }
}
