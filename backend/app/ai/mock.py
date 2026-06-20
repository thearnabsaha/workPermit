"""Deterministic, heuristic stand-ins for the Gemini agents.

Used when no API key is configured (or FORCE_MOCK=1). They run real
regex/keyword analysis on the OCR text, so the offline path produces
meaningful - not random - output.
"""
from __future__ import annotations

import re
from typing import List

from .schemas import Classification, Extraction, Language, RecommendationResult, Risk, Validation

KNOWN_AUTHORITIES = [
    "bundesagentur für arbeit",
    "bundesagentur fur arbeit",
    "ausländerbehörde",
    "auslanderbehorde",
    "bundesamt für migration",
    "bundesamt fur migration",
    "home office",
    "immigration",
    "migration",
    "ministero dell'interno",
    "préfecture",
    "prefecture",
]

TYPE_KEYWORDS = [
    ("Residence Permit", ["residence permit", "aufenthaltstitel", "aufenthaltserlaubnis", "residence card", "aufenthaltskarte"]),
    ("Work Permit", ["work permit", "arbeitserlaubnis", "beschäftigungserlaubnis", "work authorization", "permission to work"]),
    ("Employment Authorization", ["employment authorization", "ead", "arbeitsgenehmigung"]),
    ("Visa", ["visa", "visum", "schengen"]),
    ("Passport", ["passport", "reisepass", "passeport"]),
    ("National ID", ["national id", "identity card", "personalausweis", "carte d'identité"]),
    ("Driving License", ["driving licence", "driving license", "driver license", "führerschein", "permis de conduire"]),
]


def _find_dates(text: str) -> List[str]:
    iso = re.findall(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    out = [f"{y}-{m}-{d}" for (y, m, d) in iso]
    for d, mo, y in re.findall(r"\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b", text):
        yy = f"20{y}" if len(y) == 2 else y
        out.append(f"{yy}-{mo.zfill(2)}-{d.zfill(2)}")
    return out


def mock_classify(text: str) -> Classification:
    low = text.lower()
    for doc_type, words in TYPE_KEYWORDS:
        if any(w in low for w in words):
            return Classification(document_type=doc_type, classification_confidence=0.82, reasoning="Keyword match (heuristic)")
    if len(low.strip()) < 30:
        return Classification(document_type="Unknown", classification_confidence=0.3)
    return Classification(document_type="Other", classification_confidence=0.45)


def mock_language(text: str) -> Language:
    low = text.lower()
    german_hints = ["und", "der", "die", "arbeit", "aufenthalt", "gültig", "ausländer", "behörde"]
    is_german = sum(1 for w in german_hints if w in low) >= 2
    return Language(language="German" if is_german else "English", is_english=not is_german, english_translation=None)


def mock_extract(text: str) -> Extraction:
    low = text.lower()
    dates = sorted(_find_dates(text))
    permit_match = re.search(r"\b([A-Z]{2,3}(?:-[A-Z]{2,4})?-?\d{3,}[-\s]?\d*[A-Z0-9-]*)\b", text)
    permit_no = permit_match.group(1) if permit_match else None

    boundary = "nationality|permit|country|issuing|issue|expiry|document|residence|employer|occupation|visa|date|status"
    name_match = re.search(
        rf"(?:holder name|inhaber|\bname|\bnom)\s*[:\-]\s*(.*?)\s*(?:\b(?:{boundary})\b|$)",
        text,
        re.IGNORECASE,
    )
    name = name_match.group(1).strip() if name_match and name_match.group(1).strip() else None

    authority = next((a for a in KNOWN_AUTHORITIES if a in low), None)

    return Extraction(
        holder_name=name,
        nationality=None,
        permit_number=permit_no,
        permit_type=None,
        country="Germany" if ("germany" in low or "deutschland" in low) else None,
        issuing_authority=authority.title() if authority else None,
        issue_date=dates[0] if dates else None,
        expiry_date=dates[-1] if len(dates) > 1 else None,
        document_number=None,
        employer_restrictions=None,
        occupation_restrictions=None,
        visa_category=None,
        residence_status=("Authorized to work" if ("authorized to work" in low or "berechtigt" in low) else None),
        notes=None,
    )


def mock_validate(fields: Extraction, ocr_confidence: float) -> Validation:
    def present(v) -> bool:
        return v is not None and len(str(v).strip()) > 0

    required = [fields.holder_name, fields.permit_number, fields.issuing_authority, fields.expiry_date]
    fields_complete = all(present(v) for v in required)
    expiry_present = present(fields.expiry_date)
    authority_recognized = present(fields.issuing_authority)
    tampering: List[str] = []

    if present(fields.issue_date) and present(fields.expiry_date):
        try:
            if fields.expiry_date < fields.issue_date:  # ISO strings compare lexicographically
                tampering.append("Expiry date precedes issue date")
        except TypeError:
            pass
    if ocr_confidence < 0.6:
        tampering.append("Low OCR confidence")

    if tampering:
        status = "Possibly Invalid"
    elif not fields_complete or not authority_recognized:
        status = "Needs Review"
    else:
        status = "Valid"

    reasons: List[str] = []
    reasons.append("Issuing authority present" if authority_recognized else "Issuing authority not found")
    reasons.append("Expiry date present" if expiry_present else "Expiry date missing")
    reasons.append("Required fields present" if fields_complete else "Some required fields missing")
    reasons.extend(tampering)

    return Validation(
        validation_status=status,
        fields_complete=fields_complete,
        expiry_present=expiry_present,
        authority_recognized=authority_recognized,
        format_matches=ocr_confidence >= 0.6 and fields_complete,
        tampering_indicators=tampering,
        reasons=reasons,
    )


def mock_risk(validation: Validation, ocr_confidence: float) -> Risk:
    score = 10.0
    anomalies: List[str] = []
    if validation.tampering_indicators:
        score += 40 * len(validation.tampering_indicators)
        anomalies.extend(validation.tampering_indicators)
    if not validation.authority_recognized:
        score += 20
        anomalies.append("Unrecognized or missing issuing authority")
    if not validation.fields_complete:
        score += 15
        anomalies.append("Incomplete fields")
    if ocr_confidence < 0.6:
        score += 15
        anomalies.append("Low-quality scan")
    return Risk(risk_score=max(0.0, min(100.0, score)), anomalies=anomalies, confidence=ocr_confidence)


def mock_recommend(validation_status: str, risk_score: float, expired: bool, fields_complete: bool) -> RecommendationResult:
    reasons: List[str] = []
    requires = False

    if validation_status == "Unknown":
        recommendation = "Unable to Verify"
        requires = True
        reasons.append("Document type or content could not be confirmed")
    elif risk_score >= 67 or validation_status == "Possibly Invalid":
        recommendation = "Needs Human Review"
        requires = True
        reasons.append("Elevated authenticity risk or validation concerns")
    elif not fields_complete:
        recommendation = "Document Incomplete"
        requires = True
        reasons.append("Required fields are missing")
    elif expired:
        recommendation = "Needs Human Review"
        requires = True
        reasons.append("Document is expired")
    else:
        recommendation = "Likely Valid"
        reasons.append("Recognized authority, complete fields, low risk")

    confidence = max(0.3, min(0.97, 1 - risk_score / 130))
    return RecommendationResult(
        recommendation=recommendation, reasons=reasons, requires_human_review=requires, confidence=confidence
    )
