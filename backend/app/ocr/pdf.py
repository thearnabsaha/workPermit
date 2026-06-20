"""Digital-PDF text extraction.

Most real permits are digital PDFs, so this is fast and lossless. Uses pypdf
first, then falls back to pdfplumber. Scanned PDFs with no text layer return
empty text + low confidence, which the pipeline treats as "needs review".
"""
from __future__ import annotations

import io

from ..logger import logger
from .types import OcrPageResult, OcrResult


def _clean(text: str) -> str:
    return " ".join((text or "").split()).strip()


def extract_pdf_text(data: bytes) -> OcrResult:
    pages: list[OcrPageResult] = []

    # Primary: pypdf
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        for i, page in enumerate(reader.pages):
            text = _clean(page.extract_text() or "")
            pages.append(OcrPageResult(page=i + 1, text=text, confidence=0.97 if text else 0.0))
    except Exception as exc:  # noqa: BLE001
        logger.warn("ocr.pypdf_failed", error=str(exc))
        pages = []

    full_text = "\n".join(p.text for p in pages).strip()

    # Fallback: pdfplumber (better on some layouts)
    if not full_text:
        try:
            import pdfplumber

            with pdfplumber.open(io.BytesIO(data)) as pdf:
                pages = []
                for i, page in enumerate(pdf.pages):
                    text = _clean(page.extract_text() or "")
                    pages.append(OcrPageResult(page=i + 1, text=text, confidence=0.95 if text else 0.0))
            full_text = "\n".join(p.text for p in pages).strip()
        except Exception as exc:  # noqa: BLE001
            logger.warn("ocr.pdfplumber_failed", error=str(exc))

    if full_text:
        return OcrResult(
            text=full_text,
            confidence=sum(p.confidence for p in pages) / max(len(pages), 1),
            page_count=len(pages),
            pages=pages,
            engine="pdf-text",
        )
    return OcrResult(
        text="",
        confidence=0.0,
        page_count=len(pages),
        pages=pages,
        engine="empty",
        note="No embedded text layer (likely a scanned PDF). Use an image of the page for OCR.",
    )
