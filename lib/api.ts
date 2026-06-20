import type { StreamEvent } from "./types";
import { parseEventStream } from "./streamClient";
import { mockEventStream } from "./mockEvents";
import { TASK_CONFIG } from "./taskConfig";

// ============================================================================
// BACKEND INTEGRATION POINT
// ----------------------------------------------------------------------------
// runAgent() posts multipart form-data to POST /api/run and returns an async
// generator of StreamEvent. If the backend is unreachable and
// TASK_CONFIG.features.enableMockMode is true, it falls back to mock events
// with a visible warning trace so the operator knows mock is active.
//
// Wire your Flask/FastAPI endpoint to accept:
//   message: string
//   task_id: string
//   files[]: File
// and respond with newline-delimited JSON (NDJSON) or SSE StreamEvents.
// ============================================================================

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";
const ENDPOINT = process.env.NEXT_PUBLIC_API_URL || TASK_CONFIG.backendPath;

export interface RunParams {
  message: string;
  taskId: string;
  files: File[];
  mockEvents?: StreamEvent[]; // used when backend unavailable
}

// Prepends a visible warning trace + partial note before mock events so the
// operator always knows mock fallback fired — never a silent fake success.
async function* mockWithWarning(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
  yield {
    type: "trace",
    step: "mock_fallback",
    status: "warning",
    message: "Mock fallback active — backend unavailable.",
  };
  yield {
    type: "partial",
    content: "⚠️ **Mock fallback** — backend is unavailable. Showing a demo response.\n\n",
  };
  yield* mockEventStream(events);
}

export async function* runAgent(params: RunParams): AsyncGenerator<StreamEvent> {
  const { message, taskId, files, mockEvents } = params;
  const allowMock = TASK_CONFIG.features.enableMockMode;

  // Intentional forced mock (env var) — no warning, developer knows.
  if (USE_MOCK) {
    yield* mockEventStream(mockEvents ?? []);
    return;
  }

  const form = new FormData();
  form.append("message", message);
  form.append("task_id", taskId);
  for (const f of files) form.append("files", f, f.name);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: "POST", body: form });
  } catch {
    // Network failure — fall back to mock with visible warning, or surface error.
    if (mockEvents && allowMock) {
      yield* mockWithWarning(mockEvents);
      return;
    }
    yield { type: "error", message: "Backend unavailable." };
    return;
  }

  if (!res.ok || !res.body) {
    // Backend returned non-OK — fall back to mock with visible warning, or surface error.
    if (mockEvents && allowMock) {
      yield* mockWithWarning(mockEvents);
      return;
    }
    yield { type: "error", message: `Backend error ${res.status}` };
    return;
  }

  yield* parseEventStream(res.body);
}
