"""Prompt builders for each agent.

All prompts demand JSON-only output (validated by the caller), forbid inventing
data ("use null when not present"), and keep chain-of-thought internal.
"""
from __future__ import annotations

import json
from typing import Any, Dict, List

from .schemas import DOCUMENT_TYPES, RECOMMENDATIONS, VALIDATION_STATUSES

JSON_RULES = """You must respond with a SINGLE valid JSON object and nothing else.
Do not wrap it in markdown code fences. Do not add commentary before or after.
Never invent information. If a value is not clearly present in the document, use null.
Do not output your private reasoning; only output the requested JSON fields."""

SYSTEM_BASE = """You are a meticulous document-intelligence assistant for an HR work-permit review team.
You assist human reviewers; you never make final legal or hiring decisions.
You are careful, conservative, and explicit about uncertainty."""


def _truncate(text: str, limit: int = 12000) -> str:
    return text if len(text) <= limit else text[:limit] + "\n...[truncated]"


def classification_prompt(ocr_text: str) -> str:
    types = "\n".join(f"- {t}" for t in DOCUMENT_TYPES)
    return f"""{JSON_RULES}

Classify the document below into exactly one of these types:
{types}

Return JSON: {{ "document_type": <one of the above>, "classification_confidence": <0..1>, "reasoning": <short, optional> }}

DOCUMENT TEXT (from OCR, may contain noise):
\"\"\"
{_truncate(ocr_text)}
\"\"\""""


def language_prompt(ocr_text: str) -> str:
    return f"""{JSON_RULES}

Detect the primary language of the document text. If it is not English, provide a faithful English translation of the key content (names, authority, dates, statuses).

Return JSON: {{ "language": <language name in English, e.g. "German">, "is_english": <bool>, "english_translation": <string or null> }}

DOCUMENT TEXT:
\"\"\"
{_truncate(ocr_text, 8000)}
\"\"\""""


def extraction_prompt(ocr_text: str) -> str:
    return f"""{JSON_RULES}

Extract the following fields from this permit/identity document. Use null for any field not clearly present. Keep dates in ISO format (YYYY-MM-DD) when possible; otherwise copy them verbatim.

Return JSON with exactly these keys:
{{
  "holder_name", "nationality", "permit_number", "permit_type", "country",
  "issuing_authority", "issue_date", "expiry_date", "document_number",
  "employer_restrictions", "occupation_restrictions", "visa_category",
  "residence_status", "notes"
}}

DOCUMENT TEXT:
\"\"\"
{_truncate(ocr_text)}
\"\"\""""


def validation_prompt(document_type: str, fields: Dict[str, Any], ocr_confidence: float) -> str:
    statuses = ", ".join(VALIDATION_STATUSES)
    return f"""{JSON_RULES}

Assess whether this {document_type} appears genuine and complete. Consider: required fields present, expiry date present, issuing authority recognized for the country, format matches expected patterns, OCR confidence acceptable, and any tampering/inconsistency indicators (e.g. expiry before issue date, impossible dates).

OCR confidence: {round(ocr_confidence * 100)}%
Extracted fields: {json.dumps(fields)}

Choose validation_status from: {statuses}.
Never assert a final legal determination - when uncertain, prefer "Needs Review".

Return JSON: {{
  "validation_status", "fields_complete": <bool>, "expiry_present": <bool>,
  "authority_recognized": <bool>, "format_matches": <bool>,
  "tampering_indicators": <string[]>, "reasons": <string[]>
}}"""


def risk_prompt(document_type: str, fields: Dict[str, Any], ocr_confidence: float, validation_reasons: List[str]) -> str:
    return f"""{JSON_RULES}

Produce an authenticity RISK assessment (0 = no risk, 100 = very high risk) for this {document_type}.
Weigh: edited/tampered indicators, low-quality scan, missing pages/fields, unusual fonts/formatting, inconsistent dates, missing signatures/authority, suspicious OCR output.

OCR confidence: {round(ocr_confidence * 100)}%
Validation notes: {json.dumps(validation_reasons)}
Extracted fields: {json.dumps(fields)}

Return JSON: {{ "risk_score": <0..100>, "anomalies": <string[]>, "confidence": <0..1> }}"""


def recommendation_prompt(
    document_type: str,
    validation_status: str,
    risk_score: float,
    expired: bool,
    fields_complete: bool,
    reasons: List[str],
) -> str:
    recs = ", ".join(RECOMMENDATIONS)
    return f"""{JSON_RULES}

Based on the analysis, produce an HR recommendation. You assist the reviewer; you do NOT make the final decision.

Choose recommendation from: {recs}.
Set requires_human_review=true whenever there is meaningful uncertainty, elevated risk, an expired document, or incompleteness.

Inputs:
- document_type: {document_type}
- validation_status: {validation_status}
- risk_score (0..100): {risk_score}
- expired: {expired}
- fields_complete: {fields_complete}
- prior reasons: {json.dumps(reasons)}

Return JSON: {{ "recommendation", "reasons": <string[]>, "requires_human_review": <bool>, "confidence": <0..1> }}"""


VISION_OCR_PROMPT = """You are an OCR engine. Transcribe ALL readable text from this document image exactly as it appears, preserving line breaks and field labels. Do not summarize, interpret, translate, or add commentary. Output only the raw transcribed text. If the image is unreadable, output an empty response."""
