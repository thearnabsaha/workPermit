"""OCR orchestrator: dispatch by file type, expand ZIPs, merge multi-page sets."""
from __future__ import annotations

from typing import List

from .image import ocr_image
from .pdf import extract_pdf_text
from .types import InputFile, OcrPageResult, OcrResult
from .zip import expand_zip

__all__ = ["InputFile", "OcrPageResult", "OcrResult", "run_ocr", "run_ocr_many", "expand_inputs"]

ZIP_MIMES = {"application/zip", "application/x-zip-compressed", "multipart/x-zip"}


def _is_zip(f: InputFile) -> bool:
    return f.mime in ZIP_MIMES or f.name.lower().endswith(".zip")


def expand_inputs(files: List[InputFile]) -> List[InputFile]:
    """Expand any ZIP archives so the pipeline always sees a flat list of docs."""
    out: List[InputFile] = []
    for f in files:
        if _is_zip(f):
            out.extend(expand_zip(f.data))
        else:
            out.append(f)
    return out


def run_ocr(file: InputFile) -> OcrResult:
    """OCR a single document, dispatching by type."""
    name = file.name.lower()
    if file.mime == "application/pdf" or name.endswith(".pdf"):
        return extract_pdf_text(file.data)
    if file.mime.startswith("image/"):
        return ocr_image(file.data, file.mime)
    if file.mime.startswith("text/"):
        text = file.data.decode("utf-8", errors="replace").strip()
        conf = 0.99 if text else 0.0
        return OcrResult(
            text=text,
            confidence=conf,
            page_count=1,
            pages=[OcrPageResult(page=1, text=text, confidence=conf)],
            engine="text",
        )
    return OcrResult(text="", confidence=0.0, page_count=0, pages=[], engine="empty", note=f"Unsupported file type: {file.mime}")


def run_ocr_many(files: List[InputFile]) -> OcrResult:
    """OCR several documents and merge into one logical result.

    Confidence is the page-weighted mean so a single bad page doesn't dominate.
    """
    expanded = expand_inputs(files)
    if not expanded:
        return OcrResult(text="", confidence=0.0, page_count=0, pages=[], engine="empty", note="No supported documents found")

    results = [run_ocr(f) for f in expanded]
    all_pages: List[OcrPageResult] = [p for r in results for p in r.pages]
    page_count = sum(max(r.page_count, 1) for r in results)
    text = "\n\n----\n\n".join(r.text for r in results if r.text).strip()
    weight = len(all_pages) or 1
    confidence = sum(p.confidence for p in all_pages) / weight if all_pages else 0.0
    engine = next((r.engine for r in results if r.text), "empty")
    note = None if text else next((r.note for r in results if r.note), None)

    return OcrResult(
        text=text,
        confidence=confidence if text else 0.0,
        page_count=page_count,
        pages=[OcrPageResult(page=i + 1, text=p.text, confidence=p.confidence) for i, p in enumerate(all_pages)],
        engine=engine,
        note=note,
    )
