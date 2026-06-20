# Work Permit Intelligence Agent

An AI document-intelligence assistant for **Leistenschneider Personaldienstleistungen GmbH** (Saarbrücken). HR staff upload a candidate's work permit, residence permit, visa, or other identity document; the agent reads it, extracts the key fields, checks validity and expiry, assesses authenticity risk, and produces an HR recommendation with confidence scores and reasoning.

> The AI **assists** human reviewers. It never makes a final legal or hiring decision — it surfaces extracted data, confidence, and recommendations so a person can decide.

It is built entirely in **TypeScript/JavaScript**, orchestrated with **LangChain.js + LangGraph.js**, and powered exclusively by **Google Gemini**. Everything else is free and open-source, and it runs locally with **no external services and no API key** (a deterministic offline pipeline takes over, with a visible notice).

The user interface is the [`anounman/reusable-web-ui`](https://github.com/anounman/reusable-web-ui) Agent Console shell, adapted (not redesigned) per its `INSTRUCTIONS.md`.

---

## Features

- Upload **PDF, PNG/JPEG/WebP photos & scans, multi-page sets, and ZIP archives**.
- **11 cooperating agents** (LangGraph.js): Upload → OCR → Language → Classification → Extraction → Validation → Risk → Expiry → Recommendation → Notification → Analytics.
- **Document classification** into Work Permit, Residence Permit, Visa, Passport, National ID, Driving License, Employment Authorization, Residence Card, Other, Unknown — with confidence.
- **Structured field extraction** (holder, nationality, permit number, authority, dates, restrictions, …) with **Zod-validated** outputs (hallucination guard).
- **Expiry analysis** with countdown and badges (expired / ≤30 / ≤60 / ≤90 days).
- **Authenticity risk** score (0–100) plus an HR **recommendation** with reasoning.
- **Human-in-the-loop**: the review controls appear automatically when the AI is uncertain, risk is elevated, or a document is expired/incomplete.
- **Live streaming** of the workflow (safe trace — never chain-of-thought), the result artifact, and an evaluation/QA report.
- **Hybrid AI**: real Gemini when a key is present; a deterministic offline pipeline (real OCR + heuristics) otherwise — so demos always work.

## Tech stack (all free except Gemini)

| Area | Choice |
|------|--------|
| UI | Next.js 14 (App Router), React, TypeScript, TailwindCSS, Framer Motion (the reusable-web-ui shell) |
| API | Next.js Route Handler `POST /api/run` (streaming NDJSON) |
| Orchestration | LangChain.js + LangGraph.js (`StateGraph`, 11 nodes) |
| LLM | Google Gemini via `@langchain/google-genai` (chat + embeddings) |
| OCR / parse | `tesseract.js` (images), `unpdf` (digital PDF text), `sharp` (preprocessing), `jszip` (archives) |
| Validation | `zod` structured-output schemas |
| Tests | Vitest |

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

No key needed to try it: open the **Dev samples** menu in the composer to run polished offline scenarios (valid / expiring / suspicious / unknown), or upload one of the generated sample PDFs (see below). The deterministic pipeline runs real OCR + heuristic analysis.

To use real Gemini, copy `.env.example` to `.env.local` and set `GOOGLE_API_KEY` (free key at <https://aistudio.google.com/app/apikey>), then restart.

### Sample documents

```bash
npm run samples   # writes sample_data/permits/*.pdf
```

Generates four synthetic permits: a valid work permit, an expiring residence permit, a suspicious/inconsistent permit, and an unrecognized document. Upload them in the UI to see each outcome.

### Tests

```bash
npm test
```

Covers expiry math, classification/extraction/validation/risk heuristics, Zod schema guards, OCR text + ZIP handling, and a full end-to-end pipeline run that asserts the stream contract (always ends with `done`).

## How it maps onto the UI shell

The shell is task-agnostic and streams events into fixed panels. We only edited the files its `INSTRUCTIONS.md` allows:

- `lib/taskConfig.ts` — branding, labels, feature flags, `task_id`.
- `lib/types.ts` — added the `work_permit` artifact type.
- `components/ArtifactRenderer.tsx` — added one `WorkPermitCard` renderer case.
- `lib/mockEvents.ts` — added the work-permit dev samples + offline fallback.
- `app/globals.css` — re-themed accent color only.

The backend (`app/api/run/route.ts`) emits the shell's event contract: `trace` (each agent), `partial` (narration), `artifact` (`work_permit`), `evaluation`, `human_review`, and a terminating `done`.

## Project structure

```
app/
  api/run/route.ts        # streaming backend endpoint
  page.tsx, layout.tsx    # shell entry (unchanged)
components/                # shell UI + WorkPermitCard renderer
lib/
  taskConfig.ts            # task branding/flags (edited)
  types.ts                 # shell types + work_permit artifact (edited)
  mockEvents.ts            # offline fallback + dev samples (edited)
  config.ts, logger.ts, stream.ts
  agents/                  # LangGraph: state, nodes (11 agents), graph, run, expiry
  ai/                      # Gemini client, prompts, Zod schemas, hybrid + mock
  ocr/                     # pdf (unpdf), image (sharp), tesseract, zip, orchestrator
sample_data/               # sample permit generator + output
tests/                     # Vitest suite
docs/                      # architecture + deployment guides
Dockerfile, docker-compose.yml, render.yaml, .env.example
```

## Deployment

Free options (Gemini usage is the only cost). See [`docs/deployment.md`](docs/deployment.md).

- **Render** (recommended): free web service, handles streaming + long OCR. Use `render.yaml` and set `GOOGLE_API_KEY`.
- **Docker**: `docker compose up --build` then open `http://localhost:3000`.
- **Vercel**: works for lighter loads; long multi-page OCR can approach Hobby function limits.

## Security & GDPR notes

- No persistence: uploads are processed in memory and not stored — minimizing personal-data retention.
- Per-file size and count limits; only document/image/zip types are processed.
- A heuristic prompt-injection scan runs over extracted text (text is treated as data, never instructions); chain-of-thought is never exposed.
- Secrets stay server-side; the Gemini key is never sent to the browser.

## Disclaimer

This tool provides AI-assisted analysis to support human reviewers. It does not make legal determinations about a person's right to work. All hiring and compliance decisions remain with qualified HR staff. Sample documents are synthetic.
