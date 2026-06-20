import type { StreamEvent } from "./types";

// Parses a ReadableStream of either NDJSON (one JSON object per line)
// or SSE-style "data: {...}" lines into StreamEvent objects.
// Tolerant: blank lines and "event:"/":" comment lines are ignored.
export async function* parseEventStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      const evt = parseLine(line);
      if (evt) yield evt;
    }
  }
  const last = parseLine(buffer.trim());
  if (last) yield last;
}

function parseLine(line: string): StreamEvent | null {
  if (!line || line.startsWith(":") || line.startsWith("event:")) return null;
  const payload = line.startsWith("data:") ? line.slice(5).trim() : line;
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload) as StreamEvent;
  } catch {
    // Not JSON — treat raw text as a partial chunk.
    return { type: "partial", content: payload };
  }
}

// Drives a generator of events into typed callbacks. Returns when stream ends.
export async function consumeStream(
  events: AsyncGenerator<StreamEvent>,
  handlers: {
    onTrace?: (e: Extract<StreamEvent, { type: "trace" }>) => void;
    onPartial?: (text: string) => void;
    onArtifact?: (e: Extract<StreamEvent, { type: "artifact" }>) => void;
    onEvaluation?: (e: Extract<StreamEvent, { type: "evaluation" }>) => void;
    onHumanReview?: (e: Extract<StreamEvent, { type: "human_review" }>) => void;
    onError?: (msg: string) => void;
    onDone?: () => void;
  }
) {
  for await (const e of events) {
    switch (e.type) {
      case "trace":
        handlers.onTrace?.(e);
        break;
      case "partial":
        handlers.onPartial?.(e.content);
        break;
      case "artifact":
        handlers.onArtifact?.(e);
        break;
      case "evaluation":
        handlers.onEvaluation?.(e);
        break;
      case "human_review":
        handlers.onHumanReview?.(e);
        break;
      case "error":
        handlers.onError?.(e.message);
        break;
      case "done":
        handlers.onDone?.();
        break;
    }
  }
}
