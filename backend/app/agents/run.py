"""Run the LangGraph workflow and translate state updates into StreamEvents.

Always terminates with a ``done`` event - even on failure, where it emits one
safe ``error`` first so the UI never hangs.
"""
from __future__ import annotations

from typing import Any, AsyncGenerator, Dict, List

from ..logger import logger
from ..ocr import InputFile
from .graph import get_graph


async def run_pipeline_stream(files: List[InputFile], message: str) -> AsyncGenerator[Dict[str, Any], None]:
    yield {"type": "trace", "step": "workflow_started", "status": "done", "label": "Orchestrator", "message": "Multi-agent workflow started"}
    try:
        graph = get_graph()
        initial: Dict[str, Any] = {"files": files, "message": message}

        async for chunk in graph.astream(initial, stream_mode="updates"):
            # chunk maps node-name -> the update that node returned
            for update in chunk.values():
                if not update:
                    continue

                for t in update.get("traces", []) or []:
                    yield {
                        "type": "trace",
                        "step": t.get("step"),
                        "status": t.get("status"),
                        "message": t.get("message"),
                        "durationMs": t.get("durationMs"),
                        "label": t.get("label"),
                    }
                for p in update.get("partials", []) or []:
                    yield {"type": "partial", "content": p}

                artifact = update.get("artifact")
                if artifact:
                    yield {"type": "artifact", "artifact_type": artifact["artifact_type"], "data": artifact}

                evaluation = update.get("evaluation")
                if evaluation:
                    yield {"type": "evaluation", "data": evaluation}

                human_review = update.get("human_review")
                if human_review and human_review.get("required"):
                    yield {"type": "human_review", "required": True, "reason": human_review.get("reason")}
    except Exception as exc:  # noqa: BLE001
        logger.error("pipeline.failed", error=str(exc))
        yield {"type": "error", "message": f"Validation could not be completed: {exc}"}

    yield {"type": "done"}
