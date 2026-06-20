"""Image OCR via Gemini vision.

Phone photos and scans are transcribed by Gemini's multimodal model. Light
preprocessing (auto-orient, grayscale) with Pillow improves results. When no
API key is configured, image OCR is unavailable (returns empty + low
confidence), by design - the chosen OCR strategy uses Gemini for images.
"""
from __future__ import annotations

import io

from ..ai.prompts import VISION_OCR_PROMPT
from ..config import has_gemini
from ..logger import logger
from .types import OcrPageResult, OcrResult


def _preprocess(data: bytes, mime: str) -> tuple[bytes, str]:
    """Best-effort cleanup; returns (bytes, mime). Falls back to the original."""
    try:
        from PIL import Image, ImageOps

        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # auto-orient from EXIF
        img = ImageOps.grayscale(img)
        img = ImageOps.autocontrast(img)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue(), "image/png"
    except Exception as exc:  # noqa: BLE001
        logger.warn("ocr.preprocess_failed", error=str(exc))
        return data, mime


def ocr_image(data: bytes, mime: str) -> OcrResult:
    if not has_gemini():
        return OcrResult(
            text="",
            confidence=0.0,
            page_count=1,
            pages=[],
            engine="empty",
            note="Image OCR requires a Gemini API key (vision). Set GOOGLE_API_KEY, or upload a digital PDF.",
        )
    try:
        from ..ai.gemini import vision_ocr

        clean_bytes, clean_mime = _preprocess(data, mime)
        text = (vision_ocr(clean_bytes, clean_mime, VISION_OCR_PROMPT) or "").strip()
        confidence = 0.9 if len(text) > 20 else (0.5 if text else 0.0)
        return OcrResult(
            text=text,
            confidence=confidence,
            page_count=1,
            pages=[OcrPageResult(page=1, text=text, confidence=confidence)],
            engine="vision" if text else "empty",
            note=None if text else "Gemini vision returned no readable text.",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warn("ocr.vision_failed", error=str(exc))
        return OcrResult(
            text="", confidence=0.0, page_count=1, pages=[], engine="empty", note="Vision OCR failed."
        )
