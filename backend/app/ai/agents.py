"""Hybrid boundary: use Gemini when a key is present, deterministic mock otherwise.

Gemini failures (network, schema) fall back to the mock so the pipeline never
hard-fails. Each function returns ``(result, used_ai)``.
"""
from __future__ import annotations

from typing import Callable, List, Optional, Tuple, TypeVar

from ..config import has_gemini
from ..logger import logger
from . import mock, prompts
from .gemini import generate_structured
from .schemas import (
    Classification,
    Extraction,
    Language,
    RecommendationResult,
    Risk,
    Validation,
    coerce_enum,
    DOCUMENT_TYPES,
    RECOMMENDATIONS,
    VALIDATION_STATUSES,
)

T = TypeVar("T")


def _with_fallback(label: str, real: Callable[[], T], fallback: Callable[[], T]) -> Tuple[T, bool]:
    if not has_gemini():
        return fallback(), False
    try:
        return real(), True
    except Exception as exc:  # noqa: BLE001
        logger.warn("agent.fallback", label=label, error=str(exc))
        return fallback(), False


def classify_document(text: str, images: Optional[List[str]] = None) -> Tuple[Classification, bool]:
    def real() -> Classification:
        result = generate_structured(Classification, prompts.classification_prompt(text), prompts.SYSTEM_BASE, images)
        result.document_type = coerce_enum(result.document_type, DOCUMENT_TYPES, "Unknown")
        return result

    return _with_fallback("classify", real, lambda: mock.mock_classify(text))


def detect_language(text: str) -> Tuple[Language, bool]:
    return _with_fallback(
        "language",
        lambda: generate_structured(Language, prompts.language_prompt(text), prompts.SYSTEM_BASE),
        lambda: mock.mock_language(text),
    )


def extract_fields(text: str, images: Optional[List[str]] = None) -> Tuple[Extraction, bool]:
    return _with_fallback(
        "extract",
        lambda: generate_structured(Extraction, prompts.extraction_prompt(text), prompts.SYSTEM_BASE, images),
        lambda: mock.mock_extract(text),
    )


def validate_document(document_type: str, fields: Extraction, ocr_confidence: float) -> Tuple[Validation, bool]:
    def real() -> Validation:
        result = generate_structured(
            Validation,
            prompts.validation_prompt(document_type, fields.model_dump(), ocr_confidence),
            prompts.SYSTEM_BASE,
        )
        result.validation_status = coerce_enum(result.validation_status, VALIDATION_STATUSES, "Needs Review")
        return result

    return _with_fallback("validate", real, lambda: mock.mock_validate(fields, ocr_confidence))


def assess_risk(
    document_type: str, fields: Extraction, ocr_confidence: float, validation: Validation
) -> Tuple[Risk, bool]:
    return _with_fallback(
        "risk",
        lambda: generate_structured(
            Risk,
            prompts.risk_prompt(document_type, fields.model_dump(), ocr_confidence, validation.reasons),
            prompts.SYSTEM_BASE,
        ),
        lambda: mock.mock_risk(validation, ocr_confidence),
    )


def recommend_decision(
    document_type: str,
    validation_status: str,
    risk_score: float,
    expired: bool,
    fields_complete: bool,
    reasons: List[str],
) -> Tuple[RecommendationResult, bool]:
    def real() -> RecommendationResult:
        result = generate_structured(
            RecommendationResult,
            prompts.recommendation_prompt(document_type, validation_status, risk_score, expired, fields_complete, reasons),
            prompts.SYSTEM_BASE,
        )
        result.recommendation = coerce_enum(result.recommendation, RECOMMENDATIONS, "Needs Human Review")
        return result

    return _with_fallback(
        "recommend",
        real,
        lambda: mock.mock_recommend(validation_status, risk_score, expired, fields_complete),
    )
