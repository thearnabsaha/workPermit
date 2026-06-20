# Deployment guide

The app is stateless (no database, no Redis, no auth backend), so deployment is just "run the Next.js app and give it a Gemini key". Gemini usage is the only cost; everything else is free.

## 1. Get a Gemini API key (free tier)

1. Go to <https://aistudio.google.com/app/apikey>.
2. Create an API key.
3. You'll set it as the `GOOGLE_API_KEY` environment variable below.

> Without a key the app still runs end-to-end using the deterministic offline pipeline (real OCR + heuristics), with a visible "mock mode" notice.

## 2. Render (recommended, free)

A long-running Node web service handles streaming responses and multi-page OCR without serverless timeouts.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point at the repo (it reads `render.yaml`).
3. After creation, open the service → **Environment** → set `GOOGLE_API_KEY`.
4. Deploy. The free plan sleeps after inactivity and wakes on the next request.

Manual setup (without the blueprint):
- Runtime: Node, Plan: Free
- Build command: `npm ci && npm run build`
- Start command: `npm run start`
- Env: `GOOGLE_API_KEY`, optional `GEMINI_MODEL` (default `gemini-2.5-flash`), `OCR_LANGS` (default `eng+deu`).

## 3. Docker

```bash
# with a key
GOOGLE_API_KEY=your_key docker compose up --build
# or offline (no key) — uses the deterministic pipeline
docker compose up --build
```

Then open <http://localhost:3000>. The image installs dependencies, builds, and runs `next start`. Outbound network is needed at runtime for Tesseract language data (first use) and Gemini.

## 4. Vercel

Works for lighter loads. Import the repo, set `GOOGLE_API_KEY`, deploy.

- Note: long multi-page OCR + several Gemini calls can approach the Hobby plan's serverless function time limit. For heavy/multi-page workloads prefer Render. The route sets `maxDuration = 120`.

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GOOGLE_API_KEY` | for real AI | — | Gemini key (only paid dependency) |
| `GEMINI_MODEL` | no | `gemini-2.5-flash` | Gemini chat model |
| `GEMINI_EMBEDDING_MODEL` | no | `text-embedding-004` | embeddings for similarity |
| `OCR_LANGS` | no | `eng+deu` | Tesseract languages |
| `FORCE_MOCK` | no | — | `1` forces the offline pipeline |
| `NEXT_PUBLIC_USE_MOCK` | no | — | `1` forces the UI's mock streaming |
| `NEXT_PUBLIC_API_URL` | no | `/api/run` | point the UI at another backend |

## Health check

`GET /` returns the app shell (used as the Render health check path).

## Post-deploy smoke test

```bash
curl -N -X POST https://YOUR_HOST/api/run \
  -F "message=Validate this permit" \
  -F "task_id=work_permit_validation" \
  -F "files=@sample_data/permits/01-valid-work-permit.pdf;type=application/pdf"
```

You should see a stream of NDJSON `trace` lines, a `work_permit` `artifact`, an `evaluation`, and a final `{"type":"done"}`.
