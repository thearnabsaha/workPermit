import type { StreamEvent } from "./types";

// Encodes StreamEvents as newline-delimited JSON (NDJSON) — the format the
// shell's parseEventStream understands (it also accepts SSE).
export function encodeEvent(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}

/** Build a streaming Response from an async generator of StreamEvents. */
export function ndjsonResponse(generator: AsyncGenerator<StreamEvent>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await generator.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encodeEvent(value));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
