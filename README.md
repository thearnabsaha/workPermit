# Work Permit Intelligence Agent

An AI document-intelligence assistant for **Leistenschneider Personaldienstleistungen GmbH** (Saarbrücken). HR staff upload a candidate's work permit, residence permit, visa, or other identity document; the agent reads it, extracts the key fields, checks validity and expiry, assesses authenticity risk, and produces an HR recommendation with confidence scores and reasoning.

> The AI **assists** human reviewers. It never makes a final legal or hiring decision — it surfaces extracted data, confidence, and recommendations so a person can decide.

The system runs **fully locally as two processes**:

- **Frontend** — the [`anounman/reusable-web-ui`](https://github.com/anounman/reusable-web-ui) Agent Console shell (Next.js), adapted (not redesigned) per its `INSTRUCTIONS.md`.
- **Backend** — a standalone **Python FastAPI** service orchestrated with **LangGraph + LangChain**, powered exclusively by **Google Gemini**.

Everything except the Gemini API is free and open-source. **No Docker, no database.** With no API key it still runs end-to-end: digital-PDF text extraction plus a deterministic heuristic pipeline takes over (with a visible notice).

---

## Features

- Upload **PDF, PNG/JPEG/WebP photos & scans, multi-page sets, and ZIP archives**.
- **11 cooperating agents** (LangGraph): Upload → OCR → Language → Classification → Extraction → Validation → Risk → Expiry → Recommendation → Notification → Analytics.
- **Document classification** into Work Permit, Residence Permit, Visa, Passport, National ID, Driving License, Employment Authorization, Residence Card, Other, Unknown — with confidence.
- **Structured field extraction** (holder, nationality, permit number, authority, dates, restrictions, …) with **Pydantic-validated** outputs (hallucination guard).
- **Expiry analysis** with countdown and badges (expired / ≤30 / ≤60 / ≤90 days).
- **Authenticity risk** score (0–100) plus an HR **recommendation** with reasoning.
- **Human-in-the-loop**: review controls appear automatically when the AI is uncertain, risk is elevated, or a document is expired/incomplete.
- **Live streaming** of the workflow (safe trace — never chain-of-thought), the result artifact, and an evaluation/QA report.
- **Hybrid AI**: real Gemini when a key is present; a deterministic offline pipeline (real PDF OCR + heuristics) otherwise — so demos always work.

## Tech stack (all free except Gemini)

| Area | Choice |
|------|--------|
| UI | Next.js 14 (App Router), React, TypeScript, TailwindCSS, Framer Motion (the reusable-web-ui shell) |
| API | Python **FastAPI**, `POST /api/run` streaming NDJSON |
| Orchestration | **LangGraph** + **LangChain** (`StateGraph`, 11 nodes) |
| LLM | Google Gemini via `langchain-google-genai` (chat + vision + embeddings) |
| OCR / parse | `pypdf`/`pdfplumber` (digital PDF text), **Gemini vision** (image OCR), `Pillow` (preprocessing), stdlib `zipfile` (archives) |
| Validation | **Pydantic** structured-output schemas |
| Tests | Pytest |

## Quick start (two terminals)

**Terminal 1 — backend (Python 3.10+):**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend (repo root):**

```bash
npm install
npm run dev      # uses .env.local -> http://localhost:8000/api/run
# open http://localhost:3000
```

No key needed to try it: upload one of the generated sample PDFs (see below) and the offline pipeline runs real PDF text extraction + heuristic analysis. You can also open the **Dev samples** menu in the composer for polished offline scenarios.

To use real Gemini, copy `backend/.env.example` to `backend/.env`, set `GOOGLE_API_KEY` (free key at <https://aistudio.google.com/app/apikey>), and restart the backend. Image OCR (photos/scans) requires the key (it uses Gemini vision); digital PDFs and the heuristic pipeline work offline.

### Sample documents

```bash
cd backend
python scripts/generate_samples.py    # writes ../sample_data/permits/*.pdf
```

Generates four synthetic permits: a valid work permit, an expiring residence permit, a suspicious/inconsistent permit, and an unrecognized document. Upload them in the UI to see each outcome.

### Tests

```bash
cd backend
pytest
```

Covers expiry math, classification/extraction/validation/risk heuristics, Pydantic schema guards, OCR text + ZIP handling, and a full end-to-end pipeline run that asserts the stream contract (always ends with `done`).

## How it maps onto the UI shell

The shell is task-agnostic and streams events into fixed panels. It is built to call an external backend via `NEXT_PUBLIC_API_URL`, so the only frontend changes are the ones its `INSTRUCTIONS.md` allows:

- `lib/taskConfig.ts` — branding, labels, feature flags, `task_id`.
- `lib/types.ts` — added the `work_permit` artifact type.
- `components/ArtifactRenderer.tsx` — added one `WorkPermitCard` renderer case.
- `lib/mockEvents.ts` — added the work-permit dev samples + offline fallback.
- `app/globals.css` — re-themed accent color only.
- `.env.local` — points the shell at the Python backend.

The backend emits the shell's event contract: `trace` (each agent), `partial` (narration), `artifact` (`work_permit`), `evaluation`, `human_review`, and a terminating `done`.

## Project structure

```
backend/                       # Python FastAPI backend
  app/
    main.py                    # FastAPI app: CORS, /health, POST /api/run (streaming)
    config.py, logger.py, stream.py
    ai/                        # Gemini client, prompts, Pydantic schemas, hybrid + mock
    ocr/                       # pdf (pypdf/pdfplumber), image (Gemini vision), zip, orchestrator
    agents/                    # LangGraph: state, nodes (11 agents), graph, run, expiry
  scripts/generate_samples.py  # synthetic permit generator (fpdf2)
  tests/                       # Pytest suite
  requirements.txt, .env.example
app/                           # Next.js shell entry (page/layout, unchanged)
components/                    # shell UI + WorkPermitCard renderer
lib/                           # taskConfig, types, mockEvents, api (shell + edits)
sample_data/permits/           # generated sample permits
docs/                          # architecture, approach, local deployment
.env.example, .env.local       # frontend env (NEXT_PUBLIC_API_URL)
```

## Local run model

This is a local, two-process app — no Docker, no database, no cloud. See [`docs/deployment.md`](docs/deployment.md) for the full local setup and troubleshooting guide.

## Security & GDPR notes

- No persistence: uploads are processed in memory and not stored — minimizing personal-data retention.
- Per-file size and count limits; only document/image/zip types are processed.
- A heuristic prompt-injection scan runs over extracted text (text is treated as data, never instructions); chain-of-thought is never exposed.
- Secrets stay server-side; the Gemini key lives only in the backend and is never sent to the browser.
- CORS is restricted to the local frontend origin (`http://localhost:3000`).

## Disclaimer

This tool provides AI-assisted analysis to support human reviewers. It does not make legal determinations about a person's right to work. All hiring and compliance decisions remain with qualified HR staff. Sample documents are synthetic.
