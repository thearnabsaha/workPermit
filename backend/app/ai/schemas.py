"""Structured-output contracts for each AI agent.

Gemini responses are validated against these Pydantic models - a hard
hallucination/format guard. Anything that fails validation is rejected and the
agent falls back to a safe default.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

DOCUMENT_TYPES = [
    "Work Permit",
    "Residence Permit",
    "Visa",
    "Passport",
    "National ID",
    "Driving License",
    "Employment Authorization",
    "Residence Card",
    "Other",
    "Unknown",
]

VALIDATION_STATUSES = ["Valid", "Needs Review", "Possibly Invalid", "Unknown"]

RECOMMENDATIONS = [
    "Likely Valid",
    "Likely Invalid",
    "Needs Human Review",
    "Document Incomplete",
    "Unable to Verify",
]


class Classification(BaseModel):
    document_type: str = Field(description="One of the supported document types")
    classification_confidence: float = Field(ge=0, le=1)
    reasoning: Optional[str] = None


class Language(BaseModel):
    language: str
    is_english: bool
    english_translation: Optional[str] = None


class Extraction(BaseModel):
    holder_name: Optional[str] = None
    nationality: Optional[str] = None
    permit_number: Optional[str] = None
    permit_type: Optional[str] = None
    country: Optional[str] = None
    issuing_authority: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    document_number: Optional[str] = None
    employer_restrictions: Optional[str] = None
    occupation_restrictions: Optional[str] = None
    visa_category: Optional[str] = None
    residence_status: Optional[str] = None
    notes: Optional[str] = None


class Validation(BaseModel):
    validation_status: str
    fields_complete: bool
    expiry_present: bool
    authority_recognized: bool
    format_matches: bool
    tampering_indicators: List[str] = Field(default_factory=list)
    reasons: List[str] = Field(default_factory=list)


class Risk(BaseModel):
    risk_score: float = Field(ge=0, le=100)
    anomalies: List[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)


class RecommendationResult(BaseModel):
    recommendation: str
    reasons: List[str] = Field(default_factory=list)
    requires_human_review: bool
    confidence: float = Field(ge=0, le=1)


def coerce_enum(value: str, allowed: List[str], default: str) -> str:
    """Snap a model-provided string to an allowed value (case-insensitive)."""
    if value in allowed:
        return value
    low = (value or "").strip().lower()
    for item in allowed:
        if item.lower() == low:
            return item
    return default
