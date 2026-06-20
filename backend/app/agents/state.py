"""Shared LangGraph state.

Accumulator channels (traces/partials/warnings/errors) use list concatenation;
all other channels keep the latest value written (LangGraph's default for keys
without a reducer).
"""
from __future__ import annotations

import operator
from typing import Annotated, Any, Dict, List, Optional, TypedDict

from ..ocr import InputFile


class GraphState(TypedDict, total=False):
    # Inputs
    files: List[InputFile]
    message: str
    image_data_urls: List[str]
    source_names: List[str]

    # Per-agent results (plain dicts to stay serialization-friendly)
    ocr: Optional[Dict[str, Any]]
    language: Optional[Dict[str, Any]]
    classification: Optional[Dict[str, Any]]
    extraction: Optional[Dict[str, Any]]
    validation: Optional[Dict[str, Any]]
    risk: Optional[Dict[str, Any]]
    expiry: Optional[Dict[str, Any]]
    recommendation: Optional[Dict[str, Any]]

    # Final assembled outputs
    artifact: Optional[Dict[str, Any]]
    evaluation: Optional[Dict[str, Any]]
    human_review: Optional[Dict[str, Any]]

    # Bookkeeping
    used_ai: bool
    injection_detected: bool

    # Accumulators streamed to the UI
    traces: Annotated[List[Dict[str, Any]], operator.add]
    partials: Annotated[List[str], operator.add]
    warnings: Annotated[List[str], operator.add]
    errors: Annotated[List[str], operator.add]
