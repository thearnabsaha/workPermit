"""NDJSON streaming helpers.

The frontend shell's parseEventStream understands newline-delimited JSON (it
also accepts SSE). We emit one JSON object per line; every stream ends with a
``done`` event.
"""
from __future__ import annotations

import json
from typing import Any, AsyncGenerator, AsyncIterator, Dict

StreamEvent = Dict[str, Any]


def encode_event(event: StreamEvent) -> str:
    """Serialize a StreamEvent as a single NDJSON line."""
    return json.dumps(event, default=str) + "\n"


async def to_ndjson(events: AsyncIterator[StreamEvent]) -> AsyncGenerator[bytes, None]:
    """Encode an async iterator of events to NDJSON byte chunks."""
    async for event in events:
        yield encode_event(event).encode("utf-8")


async def error_stream(message: str) -> AsyncGenerator[StreamEvent, None]:
    """A self-contained error stream that still terminates with ``done``."""
    yield {"type": "error", "message": message}
    yield {"type": "done"}
