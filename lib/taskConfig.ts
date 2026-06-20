// ============================================================================
// TASK CONFIG — adapts the reusable Agent Console shell to the
// "Work Permit Intelligence Agent" for Leistenschneider Personaldienstleistungen GmbH.
// All task-specific labels, feature flags, and the endpoint live here.
// Do not scatter task labels across components.
// ============================================================================

export const TASK_CONFIG = {
  /** Displayed in the header and used as the browser title. */
  projectName: "Work Permit Intelligence Agent",

  /** Model badge in the header. */
  modelLabel: "Gemini 2.5 Flash",

  /** Sent as `task_id` in the POST /api/run request. */
  taskId: "work_permit_validation",

  /** Page title (context). `projectName` drives the document title tag. */
  title: "Work Permit Intelligence Agent",

  /** Empty-state subtitle in the chat area + meta description. */
  subtitle:
    "Upload a work permit, residence permit, visa, passport, or other identity document (PDF, image, photo, or ZIP). The agent reads it, extracts the key fields, checks validity and expiry, assesses risk, and gives an HR recommendation. The final hiring decision always stays with you.",

  /** Textarea placeholder in the composer. */
  placeholder: "Upload a permit, or describe what you need verified…",

  /** Pre-fills the composer when "Sample input" is clicked. Empty = button hidden. */
  sampleInput:
    "Validate the attached document, confirm whether it is a genuine work permit, and tell me if the holder is currently allowed to work.",

  /** Backend endpoint. Override with NEXT_PUBLIC_API_URL env var. */
  backendPath: "/api/run",

  // --------------------------------------------------------------------------
  // Feature flags — panels can also appear dynamically when the backend emits
  // the relevant event (evaluation -> evaluation panel; human_review -> review
  // controls), regardless of these flags.
  // --------------------------------------------------------------------------
  features: {
    /** Show the agent trace panel (the multi-agent workflow audit log). */
    showTracePanel: true,

    /** Show the artifact/result panel (the work-permit validation card). */
    showArtifactPanel: true,

    /** Show the evaluation panel. Also auto-shown when an evaluation event arrives. */
    showEvaluationPanel: true,

    /**
     * Human review controls. Left to the backend to trigger so reviewers only
     * see Approve/Reject when the AI is uncertain or flags risk — keeping the
     * human-in-the-loop where it matters.
     */
    showHumanReviewControls: false,

    /** Allow multiple files (multi-page sets / several documents at once). */
    allowMultipleFiles: true,

    /** Fall back to mock streaming when the backend is unreachable. */
    enableMockMode: true,
  },

  // --------------------------------------------------------------------------
  // Labels — empty-state / button text.
  // --------------------------------------------------------------------------
  labels: {
    runButton: "Validate document",
    emptyArtifactText: "The validation result appears here after the run.",
    emptyEvaluationText: "No validation checks yet.",
    emptyTraceText: "No activity yet.",
  },
};
