"""Shared OCR data types."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class InputFile:
    """A single input document (already de-zipped if it came from an archive)."""

    name: str
    mime: str
    data: bytes


@dataclass
class OcrPageResult:
    page: int
    text: str
    confidence: float  # 0..1


@dataclass
class OcrResult:
    text: str
    confidence: float  # 0..1 aggregate
    page_count: int
    pages: List[OcrPageResult] = field(default_factory=list)
    engine: str = "empty"  # pdf-text | vision | text | mock | empty
    note: Optional[str] = None
