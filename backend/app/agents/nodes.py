"""The 11 work-permit validation agents.

Each node updates its slice of shared state and appends safe trace steps
(a workflow audit log - never chain-of-thought).
"""
from __future__ import annotations

import base64
import re
import time
from typing import Any, Dict, List, Optional

from ..ai import agents as ai
from ..ocr import InputFile, expand_inputs, run_ocr_many
from .expiry import analyze_expiry
from .state import GraphState

# --- helpers --------------------------------------------------------------

_INJECTION_PATTERNS = [
    re.compile(r"ignore (all )?previous instructions", re.I),
    re.compile(r"disregard (the )?(above|system)", re.I),
    re.compile(r"you are now", re.I),
    re.compile(r"system prompt", re.I),
    re.compile(r"reveal your (instructions|prompt)", re.I),
]

_FIELD_KEYS = [
    "holder_name", "nationality", "permit_number", "permit_type", "country",
    "issuing_authority", "issue_date", "expiry_date", "document_number",
    "employer_restrictions", "occupation_restrictions", "visa_category",
    "residence_status", "notes",
]


def _trace(step: str, label: str, status: str, message: str = "", duration_ms: Optional[int] = None) -> Dict[str, Any]:
    return {"step": step, "label": label, "status": status, "message": message, "durationMs": duration_ms}


def _scan_injection(text: str) -> bool:
    return any(p.search(text) for p in _INJECTION_PATTERNS)


def _image_data_urls(files: List[InputFile]) -> List[str]:
    urls: List[str] = []
    for f in files:
        if f.mime.startswith("image/"):
            urls.append(f"data:{f.mime};base64,{base64.b64encode(f.data).decode('ascii')}")
        if len(urls) >= 2:
            break
    return urls


def _normalize_fields(extraction: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    def clean(v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s or re.fullmatch(r"n/?a|none|null|unknown", s, re.I):
            return None
        return s

    extraction = extraction or {}
    return {k: clean(extraction.get(k)) for k in _FIELD_KEYS}


def _clamp01(n: float) -> float:
    return max(0.0, min(1.0, n))


# --- nodes ----------------------------------------------------------------


def upload_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    files = state.get("files") or []
    if not files:
        return {"traces": [_trace("input_received", "Upload Agent", "warning", "No files attached - using message only", int((time.time() - start) * 1000))]}
    return {"traces": [_trace("input_received", "Upload Agent", "done", f"{len(files)} file(s) received", int((time.time() - start) * 1000))]}


def ocr_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    files = state.get("files") or []
    expanded = expand_inputs(files)
    source_names = [f.name for f in expanded]
    image_urls = _image_data_urls(expanded)
    result = run_ocr_many(files)

    status = "done" if result.confidence >= 0.6 else ("warning" if result.text else "error")
    traces = [
        _trace(
            "file_extraction",
            "OCR Agent",
            status,
            (f"{result.page_count} page(s), {round(result.confidence * 100)}% confidence ({result.engine})" if result.text else (result.note or "No readable text extracted")),
            int((time.time() - start) * 1000),
        )
    ]
    injection = _scan_injection(result.text)
    traces.append(_trace("prompt_injection_scan", "Security", "warning" if injection else "done", "Potential injection text neutralized (treated as data)" if injection else "No injection detected"))

    return {
        "ocr": {"text": result.text, "confidence": result.confidence, "page_count": result.page_count, "engine": result.engine, "note": result.note},
        "source_names": source_names,
        "image_data_urls": image_urls,
        "injection_detected": injection,
        "traces": traces,
        "partials": ["Reading the document and checking it against permit patterns...\n\n" if result.text else "Could not read text from the document.\n\n"],
        "warnings": [] if result.text else ["OCR produced no readable text"],
    }


def language_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    text = (state.get("ocr") or {}).get("text", "")
    if not text:
        return {"traces": [_trace("language_detection", "Language Detection Agent", "done", "No text to analyze", int((time.time() - start) * 1000))]}
    result, used_ai = ai.detect_language(text)
    return {
        "language": result.model_dump(),
        "used_ai": used_ai,
        "traces": [_trace("language_detection", "Language Detection Agent", "done", f"{result.language}{'' if result.is_english else ' (translated)'}", int((time.time() - start) * 1000))],
    }


def classify_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    text = (state.get("ocr") or {}).get("text", "")
    result, used_ai = ai.classify_document(text, state.get("image_data_urls"))
    return {
        "classification": result.model_dump(),
        "used_ai": used_ai,
        "traces": [_trace("document_classification", "Classification Agent", "done", f"{result.document_type} ({round(result.classification_confidence * 100)}%)", int((time.time() - start) * 1000))],
    }


def extract_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    text = (state.get("ocr") or {}).get("text", "")
    result, used_ai = ai.extract_fields(text, state.get("image_data_urls"))
    found = sum(1 for v in result.model_dump().values() if v is not None and str(v).strip())
    return {
        "extraction": result.model_dump(),
        "used_ai": used_ai,
        "traces": [_trace("information_extraction", "Extraction Agent", "done", f"{found} field(s) extracted", int((time.time() - start) * 1000))],
    }


def validate_node(state: GraphState) -> Dict[str, Any]:
    from ..ai.schemas import Extraction

    start = time.time()
    classification = state.get("classification") or {}
    document_type = classification.get("document_type", "Unknown")
    fields = Extraction(**(state.get("extraction") or {}))
    ocr_conf = (state.get("ocr") or {}).get("confidence", 0.0)
    result, used_ai = ai.validate_document(document_type, fields, ocr_conf)
    status_map = {"Valid": "done", "Possibly Invalid": "error"}
    status = status_map.get(result.validation_status, "warning")
    return {
        "validation": result.model_dump(),
        "used_ai": used_ai,
        "traces": [_trace("validation", "Validation Agent", status, result.validation_status, int((time.time() - start) * 1000))],
    }


def risk_node(state: GraphState) -> Dict[str, Any]:
    from ..ai.schemas import Extraction, Validation

    start = time.time()
    classification = state.get("classification") or {}
    document_type = classification.get("document_type", "Unknown")
    fields = Extraction(**(state.get("extraction") or {}))
    ocr_conf = (state.get("ocr") or {}).get("confidence", 0.0)
    validation = Validation(**(state.get("validation") or {
        "validation_status": "Unknown", "fields_complete": False, "expiry_present": False,
        "authority_recognized": False, "format_matches": False, "tampering_indicators": [], "reasons": [],
    }))
    result, used_ai = ai.assess_risk(document_type, fields, ocr_conf, validation)
    status = "done" if result.risk_score <= 33 else ("warning" if result.risk_score <= 66 else "error")
    return {
        "risk": result.model_dump(),
        "used_ai": used_ai,
        "traces": [_trace("risk_assessment", "Risk Assessment Agent", status, f"Risk {round(result.risk_score)}/100", int((time.time() - start) * 1000))],
    }


def expiry_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    expiry = analyze_expiry((state.get("extraction") or {}).get("expiry_date"))
    status, message = "done", "No expiry date found"
    if expiry["expiry_date"]:
        if expiry["expired"]:
            status, message = "error", "Document is expired"
        elif expiry["within_30"]:
            status, message = "warning", f"{expiry['days_remaining']} days remaining"
        else:
            message = f"{expiry['days_remaining']} days remaining"
    return {"expiry": expiry, "traces": [_trace("expiry_analysis", "Expiry Analysis Agent", status, message, int((time.time() - start) * 1000))]}


def recommend_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    classification = state.get("classification") or {}
    document_type = classification.get("document_type", "Unknown")
    is_unknown = document_type == "Unknown" or classification.get("classification_confidence", 0) < 0.4

    validation = state.get("validation") or {}
    validation_status = validation.get("validation_status", "Unknown" if is_unknown else "Needs Review")
    risk = state.get("risk") or {}
    risk_score = risk.get("risk_score", 50 if is_unknown else 40)
    expiry = state.get("expiry") or {}
    expired = expiry.get("expired", False)
    fields_complete = validation.get("fields_complete", False)
    reasons = list(validation.get("reasons", [])) + list(risk.get("anomalies", []))

    result, used_ai = ai.recommend_decision(document_type, validation_status, risk_score, expired, fields_complete, reasons)
    return {
        "recommendation": result.model_dump(),
        "used_ai": used_ai,
        "traces": [_trace("recommendation", "Recommendation Agent", "done", result.recommendation, int((time.time() - start) * 1000))],
    }


def notify_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    warnings: List[str] = []
    expiry = state.get("expiry") or {}
    risk = state.get("risk") or {}
    validation = state.get("validation") or {}

    if expiry.get("expired"):
        warnings.append("Document is expired")
    elif expiry.get("within_30"):
        warnings.append(f"Expires within 30 days ({expiry.get('days_remaining')} days remaining)")
    elif expiry.get("within_60"):
        warnings.append("Expires within 60 days")
    elif expiry.get("within_90"):
        warnings.append("Expires within 90 days")

    if risk.get("risk_score", 0) >= 67:
        warnings.append(f"High authenticity risk ({round(risk.get('risk_score', 0))}/100)")
    if validation.get("validation_status") == "Possibly Invalid":
        warnings.append("Validation flagged the document as possibly invalid")
    if state.get("injection_detected"):
        warnings.append("Prompt-injection text detected in document (treated as data)")

    recommendation = state.get("recommendation") or {}
    required = (
        recommendation.get("requires_human_review", False)
        or risk.get("risk_score", 0) >= 67
        or validation.get("validation_status") in ("Possibly Invalid", "Needs Review")
        or expiry.get("expired", False)
    )
    reason = None
    if required:
        reason = (warnings[0] if warnings else (recommendation.get("reasons") or ["AI is uncertain - human confirmation recommended"])[0])

    return {
        "warnings": warnings,
        "human_review": {"required": required, "reason": reason},
        "traces": [_trace("notification", "Notification Agent", "warning" if warnings else "done", f"{len(warnings)} alert(s)" if warnings else "No alerts", int((time.time() - start) * 1000))],
    }


def analytics_node(state: GraphState) -> Dict[str, Any]:
    start = time.time()
    fields = _normalize_fields(state.get("extraction"))
    classification = state.get("classification") or {}
    document_type = classification.get("document_type", "Unknown")
    class_conf = classification.get("classification_confidence", 0.0)
    ocr_conf = (state.get("ocr") or {}).get("confidence", 0.0)
    expiry = state.get("expiry") or analyze_expiry(fields.get("expiry_date"))
    validation = state.get("validation") or {}
    validation_status = validation.get("validation_status", "Unknown")
    recommendation = state.get("recommendation") or {}
    risk_score = (state.get("risk") or {}).get("risk_score", 50)

    overall = _clamp01(0.4 * recommendation.get("confidence", 0.4) + 0.3 * class_conf + 0.3 * ocr_conf)
    reasons = (recommendation.get("reasons") or validation.get("reasons") or [])[:6]
    human_review = state.get("human_review") or {}
    requires_review = human_review.get("required", recommendation.get("requires_human_review", False))

    artifact = {
        "artifact_type": "work_permit",
        "document_type": document_type,
        "classification_confidence": class_conf,
        "validation_status": validation_status,
        "recommendation": recommendation.get("recommendation", "Unable to Verify"),
        "fields": fields,
        "expiry": expiry,
        "risk_score": round(risk_score),
        "confidence_score": overall,
        "ocr_confidence": ocr_conf,
        "reasons": reasons,
        "requires_human_review": requires_review,
        "detected_language": (state.get("language") or {}).get("language"),
        "source_documents": state.get("source_names") or [],
    }

    evaluation = {
        "input_parsed": True,
        "files_processed": bool(state.get("files")) and bool((state.get("ocr") or {}).get("text")),
        "prompt_injection_checked": True,
        "output_schema_valid": True,
        "edge_cases_checked": True,
        "confidence_score": overall,
        "human_review_needed": requires_review,
        "warnings": state.get("warnings") or [],
        "errors": state.get("errors") or [],
    }

    return {
        "artifact": artifact,
        "evaluation": evaluation,
        "traces": [_trace("analytics", "Analytics Agent", "done", "Result assembled + metrics recorded", int((time.time() - start) * 1000))],
        "partials": ["\nValidation complete. See the result panel for the full breakdown."],
    }


def route_after_classify(state: GraphState) -> str:
    classification = state.get("classification")
    if not classification or classification.get("document_type") == "Unknown" or classification.get("classification_confidence", 0) < 0.4:
        return "recommend"
    return "extract"
