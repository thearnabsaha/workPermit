import type { StreamEvent } from "../types";
import type { InputFile } from "../ocr";
import type { GraphUpdate } from "./state";
import { createInitialState, getGraph } from "./graph";
import { logger } from "../logger";

// Runs the LangGraph workflow and translates each node's state update into the
// shell's StreamEvent contract. Always terminates with a `done` event — even on
// failure, where it emits a single safe `error` first so the UI never hangs.
export async function* runPipelineStream(files: InputFile[], message: string): AsyncGenerator<StreamEvent> {
  yield { type: "trace", step: "workflow_started", status: "done", label: "Orchestrator", message: "Multi-agent workflow started" };
  try {
    const graph = getGraph();
    const stream = await graph.stream(createInitialState(files, message), { streamMode: "updates" });

    for await (const chunk of stream) {
      for (const update of Object.values(chunk) as GraphUpdate[]) {
        if (!update) continue;

        for (const t of update.traces ?? []) {
          yield { type: "trace", step: t.step, status: t.status, message: t.message, durationMs: t.durationMs, details: t.details, label: t.label };
        }
        for (const p of update.partials ?? []) {
          yield { type: "partial", content: p };
        }
        if (update.artifact) {
          yield { type: "artifact", artifact_type: update.artifact.artifact_type, data: update.artifact };
        }
        if (update.evaluation) {
          yield { type: "evaluation", data: update.evaluation };
        }
        if (update.humanReview?.required) {
          yield { type: "human_review", required: true, reason: update.humanReview.reason };
        }
      }
    }
  } catch (err) {
    logger.error("pipeline.failed", { error: (err as Error).message });
    yield { type: "error", message: `Validation could not be completed: ${(err as Error).message}` };
  }
  yield { type: "done" };
}
