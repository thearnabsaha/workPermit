# Local setup & run guide

This app runs entirely on your machine as **two processes** — a Python FastAPI backend and the Next.js frontend. There is **no Docker, no database, and no cloud deployment**. The only paid dependency is the Gemini API (optional — it runs offline without it).

## Prerequisites

- **Python 3.10+** (tested on 3.13)
- **Node.js 18.18+** (for the Next.js shell)
- A free **Gemini API key** (optional): <https://aistudio.google.com/app/apikey>

## 1. Backend (Python FastAPI)

```bash
cd backend

# create + activate a virtual environment
python -m venv .venv
.venv\Scripts\activate            # Windows PowerShell
# source .venv/bin/activate       # macOS / Linux

pip install -r requirements.txt

# optional: enable real Gemini
copy .env.example .env            # Windows  (cp on macOS/Linux)
# edit .env and set GOOGLE_API_KEY=...

uvicorn app.main:app --reload --port 8000
```

Verify it's up:

```bash
curl http://localhost:8000/health
# {"status":"ok","gemini":false,"model":"gemini-2.5-flash"}
```

`gemini` is `false` until you set a key — the backend still works using digital-PDF text extraction + the heuristic pipeline.

## 2. Frontend (Next.js shell)

From the **repo root** (a second terminal):

```bash
npm install
npm run dev
```

`.env.local` already points the shell at the backend:

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/run
```

Open <http://localhost:3000>.

## 3. Try it

- Generate sample permits: `cd backend && python scripts/generate_samples.py` (writes to `sample_data/permits/`).
- Upload one in the UI — or open the composer's **Dev samples** menu for offline scenarios.
- With a Gemini key set, you can also upload **photos/scans** (image OCR uses Gemini vision).

## Environment variables

**Backend (`backend/.env`):**

| Variable | Purpose | Default |
|----------|---------|---------|
| `GOOGLE_API_KEY` | Gemini key. Empty = offline pipeline. | _(empty)_ |
| `GEMINI_MODEL` | Chat/vision model. | `gemini-2.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | Embedding model. | `text-embedding-004` |
| `FORCE_MOCK` | `1` forces the offline pipeline even with a key. | _(empty)_ |
| `FRONTEND_ORIGIN` | Allowed CORS origin. | `http://localhost:3000` |

**Frontend (`.env.local`):**

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Backend endpoint the shell POSTs to. | `http://localhost:8000/api/run` |
| `NEXT_PUBLIC_USE_MOCK` | Force the shell's built-in mock (skip the backend). | _(empty)_ |

## Tests

```bash
cd backend
pytest
```

## Troubleshooting

- **`uvicorn: address already in use`** — another process holds port 8000. Stop it, or run `uvicorn app.main:app --port 8001` and update `NEXT_PUBLIC_API_URL` to match.
- **Frontend shows results but no real AI** — check `/health` shows `"gemini": true`. If not, confirm `GOOGLE_API_KEY` is set in `backend/.env` and restart the backend.
- **Image upload returns "Image OCR requires a Gemini API key"** — expected offline; set a key, or upload a digital PDF.
- **CORS error in the browser console** — make sure the frontend runs on `http://localhost:3000` (or set `FRONTEND_ORIGIN` to your actual origin and restart the backend).
- **Changes to `.env.local` not picked up** — restart `npm run dev` (Next.js reads public env at startup).
