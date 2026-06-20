// Shared contract between UI and backend. Keep in sync with Flask/FastAPI side.

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
}

export type TraceStatus = "pending" | "running" | "done" | "warning" | "error";

export interface TraceStep {
  step: string; // machine id, e.g. "file_extraction"
  label?: string; // human label; falls back to prettified step
  status: TraceStatus;
  message?: string;
  durationMs?: number;
  details?: string;
}

// ---- Artifacts -----------------------------------------------------------
// Discriminated union by `artifact_type`. Add new product artifacts here.

export interface InvoiceAssignment {
  line_item: string;
  team: string;
  amount: number;
  confidence: number;
  reason: string;
}
export interface InvoiceArtifact {
  artifact_type: "invoice";
  invoice_id: string;
  vendor: string;
  total_amount: number;
  currency: string;
  assignments: InvoiceAssignment[];
  team_totals: Record<string, number>;
  requires_human_review: boolean;
}

export interface CandidateArtifact {
  artifact_type: "candidate";
  name: string;
  role?: string;
  summary: string;
  match_score?: number;
  strengths?: string[];
  concerns?: string[];
  skills?: string[];
}

export interface VideoScene {
  time_range: string;
  prompt: string;
  voiceover?: string;
}
export interface VideoArtifact {
  artifact_type: "video";
  title: string;
  status: string;
  video_url: string;
  scenes: VideoScene[];
}

export interface TableArtifact {
  artifact_type: "table";
  title?: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface MarkdownArtifact {
  artifact_type: "markdown" | "text";
  title?: string;
  content: string;
}

export interface ImageArtifact {
  artifact_type: "image";
  title?: string;
  url: string;
}

export interface JsonArtifact {
  artifact_type: "json";
  title?: string;
  data: unknown;
}

// ---- Work permit (this product's primary artifact) -----------------------
export type DocumentType =
  | "Work Permit"
  | "Residence Permit"
  | "Visa"
  | "Passport"
  | "National ID"
  | "Driving License"
  | "Employment Authorization"
  | "Residence Card"
  | "Other"
  | "Unknown";

export type ValidationStatus = "Valid" | "Needs Review" | "Possibly Invalid" | "Unknown";

export type Recommendation =
  | "Likely Valid"
  | "Likely Invalid"
  | "Needs Human Review"
  | "Document Incomplete"
  | "Unable to Verify";

/** Extracted permit fields. Every field is optional — a missing field is
 *  rendered as "Not found" rather than invented (hallucination guard). */
export interface WorkPermitFields {
  holder_name?: string | null;
  nationality?: string | null;
  permit_number?: string | null;
  permit_type?: string | null;
  country?: string | null;
  issuing_authority?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  document_number?: string | null;
  employer_restrictions?: string | null;
  occupation_restrictions?: string | null;
  visa_category?: string | null;
  residence_status?: string | null;
  notes?: string | null;
}

export interface ExpiryAnalysis {
  expiry_date?: string | null;
  days_remaining?: number | null;
  expired: boolean;
  within_30: boolean;
  within_60: boolean;
  within_90: boolean;
}

export interface WorkPermitArtifact {
  artifact_type: "work_permit";
  title?: string;
  document_type: DocumentType;
  classification_confidence: number; // 0..1
  validation_status: ValidationStatus;
  recommendation: Recommendation;
  fields: WorkPermitFields;
  expiry: ExpiryAnalysis;
  risk_score: number; // 0..100 (higher = riskier)
  confidence_score: number; // 0..1 overall
  ocr_confidence: number; // 0..1
  reasons: string[]; // HR-facing reasoning bullets
  requires_human_review: boolean;
  detected_language?: string | null;
  source_documents?: string[]; // file names included in this assessment
}

// Fallback for anything not modeled above.
export interface GenericArtifact {
  artifact_type: string;
  title?: string;
  data?: unknown;
  [k: string]: unknown;
}

export type Artifact =
  | InvoiceArtifact
  | CandidateArtifact
  | VideoArtifact
  | TableArtifact
  | MarkdownArtifact
  | ImageArtifact
  | JsonArtifact
  | WorkPermitArtifact
  | GenericArtifact;

// ---- Evaluation ----------------------------------------------------------
export interface Evaluation {
  input_parsed?: boolean;
  files_processed?: boolean;
  prompt_injection_checked?: boolean;
  output_schema_valid?: boolean;
  edge_cases_checked?: boolean;
  confidence_score?: number; // 0..1
  human_review_needed?: boolean;
  errors?: string[];
  warnings?: string[];
}

// ---- Stream events (NDJSON / SSE) ---------------------------------------
export type StreamEvent =
  | { type: "trace"; step: string; status: TraceStatus; message?: string; durationMs?: number; details?: string; label?: string }
  | { type: "partial"; content: string }
  | { type: "artifact"; artifact_type: string; data?: unknown; [k: string]: unknown }
  | { type: "evaluation"; data: Evaluation }
  | { type: "human_review"; required: boolean; reason?: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type ReviewStatus = "none" | "approved" | "rejected" | "needs_review";
