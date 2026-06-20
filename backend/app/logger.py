"""Minimal structured logger.

Emits single-line JSON so logs are greppable in any local terminal without
extra dependencies.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from typing import Any


def _emit(level: str, msg: str, **meta: Any) -> None:
    line = json.dumps(
        {"ts": datetime.now(timezone.utc).isoformat(), "level": level, "msg": msg, **meta},
        default=str,
    )
    stream = sys.stderr if level in ("warn", "error") else sys.stdout
    print(line, file=stream, flush=True)


class Logger:
    def debug(self, msg: str, **meta: Any) -> None:
        _emit("debug", msg, **meta)

    def info(self, msg: str, **meta: Any) -> None:
        _emit("info", msg, **meta)

    def warn(self, msg: str, **meta: Any) -> None:
        _emit("warn", msg, **meta)

    def error(self, msg: str, **meta: Any) -> None:
        _emit("error", msg, **meta)


logger = Logger()
