import pytest
from pydantic import ValidationError

from app.ai.schemas import Classification, Extraction, RecommendationResult, Risk, coerce_enum, DOCUMENT_TYPES


def test_valid_classification():
    c = Classification(document_type="Work Permit", classification_confidence=0.9)
    assert c.classification_confidence == 0.9


def test_confidence_out_of_range():
    with pytest.raises(ValidationError):
        Classification(document_type="Visa", classification_confidence=5)


def test_risk_out_of_range():
    with pytest.raises(ValidationError):
        Risk(risk_score=200, anomalies=[], confidence=0.5)


def test_extraction_allows_nulls():
    e = Extraction(holder_name=None, expiry_date="2030-01-01")
    assert e.holder_name is None
    assert e.expiry_date == "2030-01-01"


def test_recommendation_requires_fields():
    r = RecommendationResult(recommendation="Likely Valid", reasons=[], requires_human_review=False, confidence=0.8)
    assert r.requires_human_review is False


def test_coerce_enum_snaps_case():
    assert coerce_enum("work permit", DOCUMENT_TYPES, "Unknown") == "Work Permit"
    assert coerce_enum("Banana", DOCUMENT_TYPES, "Unknown") == "Unknown"
