"""ZIP expansion using the stdlib (no extra dependency)."""
from __future__ import annotations

import io
import zipfile
from typing import List

from ..logger import logger
from .types import InputFile

MIME_BY_EXT = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "bmp": "image/bmp",
    "txt": "text/plain",
}


def _mime_for(name: str) -> str | None:
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return MIME_BY_EXT.get(ext)


def expand_zip(data: bytes) -> List[InputFile]:
    """Expand a ZIP into supported document files, ignoring junk/metadata."""
    out: List[InputFile] = []
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                base = info.filename.rsplit("/", 1)[-1]
                if base.startswith(".") or "__MACOSX" in info.filename:
                    continue
                mime = _mime_for(base)
                if not mime:
                    continue
                out.append(InputFile(name=base, mime=mime, data=zf.read(info)))
    except Exception as exc:  # noqa: BLE001
        logger.warn("ocr.zip_failed", error=str(exc))
    return out
