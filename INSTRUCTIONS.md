# INSTRUCTIONS.md — Agent Console UI Shell

Integration manual for AI assistants and developers plugging this shell into a new hackathon task.

**The UI is task-agnostic. Do not assume the next task is invoice, CV, or video.**

---

## 1. What this UI is

A reusable, task-agnostic AI agent UI shell for FDE hackathon mini-products.
One codebase. Up to 11 different company tasks. No task bias baked in.

Panels:
- **Chat** — user sends messages, assistant streams markdown responses
- **File upload** — drag-drop multi-file with inline previews (image, video, PDF)
- **Agent trace** — safe workflow audit log
- **Artifact** — structured result rendered by type
- **Evaluation** — optional quality/testing report
- **Human review** — optional approve/reject controls

The default screen is neutral: no task tabs, no company-specific labels.
All configuration lives in `lib/taskConfig.ts`.

---

## 2. Task configuration — `lib/taskConfig.ts`

**All customization starts here. Edit this file first, and only this file, for most tasks.**

```ts
export const TASK_CONFIG = {
  projectName: "Agent Console",     // header + browser <title>
  modelLabel: "Gemini 2.5 Flash-Lite",
  taskId: "default_agent",          // sent as task_id to POST /api/run
  title: "AI Agent Workspace",
  subtitle: "...",                  // empty-state text + <meta description>
  placeholder: "...",               // textarea placeholder
  sampleInput: "",                  // pre-fills composer; empty = button hidden
  backendPath: "/api/run",

  features: {
    showTracePanel: true,           // show agent trace panel
    showArtifactPanel: true,        // show artifact/result panel
    showEvaluationPanel: true,      // show evaluation panel (also auto-shown on eval event)
    showHumanReviewControls: false, // show review buttons (also auto-shown on backend signal)
    allowMultipleFiles: true,
    enableMockMode: true,
  },

  labels: {
    runButton: "Run agent",
    emptyArtifactText: "Result appears here after the run.",
    emptyEvaluationText: "No evaluation yet.",
    emptyTraceText: "No activity yet.",
  },
};
```

### Panel visibility rules

| Panel | Shown when |
|-------|-----------|
| Trace | `features.showTracePanel === true` |
| Artifact | `features.showArtifactPanel === true` |
| Evaluation | `features.showEvaluationPanel === true` **OR** backend sends an `evaluation` event |
| Human review | `features.showHumanReviewControls === true` **OR** backend sends `human_review` event / `human_review_needed: true` / `requires_human_review: true` |

Backend events always take precedence. A task with `showEvaluationPanel: false` will still show the evaluation panel if the backend emits an `evaluation` event.

---

## 3. Adapt for a new task in under 2 minutes

```
1. Open lib/taskConfig.ts
2. Set projectName, taskId, subtitle, placeholder, sampleInput
3. Set features.showEvaluationPanel and showHumanReviewControls as needed
4. Set NEXT_PUBLIC_API_URL=http://your-backend/api/run
5. npm run dev
```

Done. The backend's event stream decides what renders.

---

## 4. Files to edit

| File | What to change |
|------|----------------|
| `lib/taskConfig.ts` | **Start here.** Labels, feature flags, taskId, backendPath |
| `lib/mockEvents.ts` | Add a dev sample to `DEV_SAMPLES` for local testing |
| `lib/api.ts` | Backend endpoint logic — rarely needs changes |
| `lib/types.ts` | Add new artifact type to the union if needed |
| `components/ArtifactRenderer.tsx` | Add a `case` for a new artifact type |
| `components/EvaluationPanel.tsx` | Add/remove check keys in `CHECKS` array |
| `app/globals.css` | CSS vars for re-theming (colors only) |
| `components/ChatShell.tsx` | Orchestrator — only touch for layout structure changes |

**Avoid changing many files at once.** Most tasks only need `lib/taskConfig.ts`.

---

## 5. Backend contract

**Endpoint:** `POST /api/run`

**Request:** multipart form data

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | User's text input |
| `task_id` | string | From `TASK_CONFIG.taskId` |
| `files` | File[] | Uploaded files (repeat field) |

**Response:** streaming NDJSON (one JSON object per line) or SSE (`data: {...}\n\n`).

### Supported event shapes

```json
{ "type": "trace", "step": "input_received", "status": "done", "message": "Request received", "durationMs": 40 }
{ "type": "trace", "step": "file_extraction", "status": "running", "message": "Extracting..." }
{ "type": "trace", "step": "file_extraction", "status": "done", "durationMs": 1300 }
{ "type": "partial", "content": "Analyzing..." }
{ "type": "artifact", "artifact_type": "generic", "data": { ... } }
{ "type": "evaluation", "data": { ... } }
{ "type": "human_review", "required": true, "reason": "Low confidence result" }
{ "type": "done" }
{ "type": "error", "message": "Something failed safely." }
```

`trace` status values: `"pending"` | `"running"` | `"done"` | `"warning"` | `"error"`

Optional trace fields: `durationMs`, `details` (expandable), `label` (human-readable step name override).

**The `done` event is required.** A stream that closes without it is treated as a truncated error. Never omit it.

**Fallback:** if the backend is unreachable, `lib/api.ts` falls back to mock events. The UI never breaks during demos.

**Force mock mode:** `NEXT_PUBLIC_USE_MOCK=1`

---

## 6. What "artifact" means

Artifact = the **final structured output** from the agent.

It is NOT:
- the agent itself
- a workflow step
- an evaluation result

The backend emits `{ "type": "artifact", "artifact_type": "...", "data": { ... } }`.
The UI dispatches on `artifact_type` to choose a renderer.
Unknown `artifact_type` values fall back safely to JSON pretty-print — **never crash**.

### Supported artifact types

| `artifact_type` | Renderer |
|-----------------|----------|
| `"text"` / `"markdown"` | Markdown renderer |
| `"json"` | JSON pretty-print |
| `"table"` | `{ columns, rows }` table |
| `"image"` | `{ url }` inline image |
| `"video"` | `{ title, video_url, scenes[] }` player + scene list |
| `"invoice"` | Invoice allocation table with confidence |
| `"candidate"` | CV summary card with match score |
| `"generic"` / unknown | JSON pretty-print fallback |

`invoice`, `candidate`, and `video` are **renderer capabilities only** — not default tasks.
Do not assume every task outputs one of these.

To add a new type: add a `case` in `components/ArtifactRenderer.tsx` and extend the `Artifact` union in `lib/types.ts`.

---

## 7. What "trace" means

Trace = **safe workflow audit log**. What the system did, not how it reasoned.

### Emit these
- Input received
- Files uploaded / extracted
- Prompt injection scan complete
- Agent workflow started / complete
- Tool executed (name the tool)
- Output validated
- Result generated
- Human review required

### Never emit these
- Hidden chain-of-thought
- Internal model reasoning or scratchpad
- Raw system prompt text
- Long intermediate model thoughts

---

## 8. What "evaluation" means

Evaluation = **quality/testing report** produced by the agent or an evaluator.

It answers:
- Did the input parse correctly?
- Were files processed?
- Was prompt injection checked?
- Is the output schema valid?
- Were edge cases handled?
- What is the confidence?
- Are there warnings or errors?

```json
{
  "input_parsed": true,
  "files_processed": true,
  "prompt_injection_checked": true,
  "output_schema_valid": true,
  "edge_cases_checked": true,
  "confidence_score": 0.86,
  "human_review_needed": false,
  "warnings": ["Low confidence on item 3"],
  "errors": []
}
```

**Evaluation is optional.** Not every task needs it.

- `features.showEvaluationPanel: false` → panel hidden unless the backend sends an `evaluation` event.
- `features.showEvaluationPanel: true` → panel visible even before an event (shows empty state).
- Every task should emit evaluation for FDE demos — it shows quality assurance.

---

## 9. What "human review" means

Human review = **optional action controls** for tasks where a person must approve or reject the output.

### Needed for
- Hiring/recruiting decisions
- Sending emails or messages
- Invoice approval or payment routing
- Legal or financial actions
- Irreversible operations
- Low-confidence results

### Not needed for
- Read-only analysis tasks
- Informational summaries
- High-confidence automated outputs

**Human review controls are hidden by default** (`showHumanReviewControls: false`).

They appear automatically when:
- `features.showHumanReviewControls: true` is set, **or**
- the backend sends `{ "type": "human_review", "required": true }`, **or**
- `evaluation.human_review_needed === true`, **or**
- `artifact.requires_human_review === true`

Controls (Approve / Reject / Needs review) are UI-state only — wire to a backend endpoint if persistence is needed.

---

## 10. Avoid task bias

- Do not hardcode invoice/CV/video as default UI.
- Do not show task-specific demo tabs in the main interface.
- Do not assume the next task is HR, invoice, video, or recruiting.
- Start neutral — backend events decide what panels render.
- Keep special renderers (invoice, candidate, video) as capabilities, not defaults.
- `DEV_SAMPLES` in `lib/mockEvents.ts` are for developer testing only — hidden behind a "Dev samples" menu.

---

## 11. New task checklist

```
[ ] 1.  Edit lib/taskConfig.ts: projectName, taskId, subtitle, placeholder
[ ] 2.  Decide: showEvaluationPanel needed? (set in features)
[ ] 3.  Decide: showHumanReviewControls needed? (set in features, or let backend trigger)
[ ] 4.  Decide: expected artifact_type from this task
[ ] 5.  Add artifact renderer case only if generic/table/json/markdown doesn't cover it
[ ] 6.  Add a DEV_SAMPLES entry in lib/mockEvents.ts for local testing
[ ] 7.  Set NEXT_PUBLIC_API_URL=http://your-backend/api/run
[ ] 8.  Test: NEXT_PUBLIC_USE_MOCK=1 npm run dev
[ ] 9.  Verify: trace updates → artifact renders → panels show/hide correctly
[ ] 10. Switch off mock and test with real backend
[ ] 11. Verify: kill backend mid-run → UI unlocks, safe error shown
[ ] 12. Run demo flow end-to-end; check polished appearance
```

---

## 12. What not to do

- Do not rebuild the UI for each task — adapt `lib/taskConfig.ts`
- Do not show task-specific tabs in the main UI by default
- Do not show chain-of-thought in trace events
- Do not remove mock mode — demos must work offline
- Do not hard-code API keys in frontend code
- Do not hard-code `<title>` or `<meta description>` in `app/layout.tsx` — they come from `TASK_CONFIG`
- Do not omit the `{ "type": "done" }` event — absence is treated as a stream error
- Do not assume every task needs evaluation or human review
- Do not add complex state management — plain `useState` in `ChatShell.tsx` is enough
- Do not over-abstract — three similar lines beat a premature abstraction

---

## 13. Quick test checklist

```
[ ] App starts: npm run dev → http://localhost:3000
[ ] Empty state shows neutral subtitle from TASK_CONFIG.subtitle
[ ] Browser tab shows TASK_CONFIG.projectName
[ ] Chat input: type a message, press Enter, assistant responds
[ ] File upload: drag a file, chip appears with preview
[ ] Dev samples: click "Dev samples" in toolbar → pick one → all enabled panels populate
[ ] Trace panel: steps appear in order with correct status icons
[ ] Artifact panel: correct renderer for the artifact_type (unknown type → JSON fallback)
[ ] Evaluation panel: hidden if no eval event AND showEvaluationPanel: false
[ ] Human review: hidden until backend signals required or feature flag enabled
[ ] Error state: kill backend mid-run → UI unlocks, safe error shown
[ ] Truncated stream: backend closes without done event → treated as error
[ ] No task-specific tabs or labels visible in default state
```

---

## Prompt for future AI assistants

> "Read `INSTRUCTIONS.md` first. Then adapt this UI shell for the following company task. Do not redesign the UI. Do not change unrelated files. Start with `lib/taskConfig.ts` — set projectName, taskId, subtitle, placeholder, and feature flags. Add a dev sample to `lib/mockEvents.ts` DEV_SAMPLES. Add a new artifact renderer case only if the task output type is not covered by generic/table/json/markdown. Set showHumanReviewControls and showEvaluationPanel based on whether this task needs them. Keep the UI polished, task-agnostic in default state, and demo-ready."
