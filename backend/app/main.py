"""FastAPI entry point for the Work Permit Intelligence Agent backend.

Exposes a single streaming endpoint, ``POST /api/run``, matching the contract
the reusable-web-ui frontend shell expects (multipart in, NDJSON events out).
"""
from __future__ import annotations

from fastapi import FastAPI, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .config import config, has_gemini
from .logger import logger
from .ocr import InputFile
from .stream import error_stream, to_ndjson

app = FastAPI(title="Work Permit Intelligence Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.frontend_origin, "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB per file
MAX_FILES = 20

EXT_MIME = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "bmp": "image/bmp",
    "zip": "application/zip",
    "txt": "text/plain",
}


def _resolve_mime(file: UploadFile) -> str:
    if file.content_type and file.content_type != "application/octet-stream":
        return file.content_type
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    return EXT_MIME.get(ext, "application/octet-stream")


def _stream(generator) -> StreamingResponse:
    return StreamingResponse(
        to_ndjson(generator),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "gemini": has_gemini(), "model": config.gemini_model})


@app.post("/api/run")
async def run(request: Request, message: str = Form(default=""), task_id: str = Form(default="")):
    # Lazy import so a graph/import error surfaces as a safe stream, not a 500.
    from .agents.run import run_pipeline_stream

    try:
        form = await request.form()
        # Form values are either str (text fields) or an UploadFile. Filter by
        # "not a string" so we catch Starlette's UploadFile too (FastAPI's is a
        # subclass, so an isinstance check against fastapi.UploadFile misses it).
        uploads = [v for v in form.getlist("files") if not isinstance(v, str)]
    except Exception as exc:  # noqa: BLE001
        logger.error("route.parse_failed", error=str(exc))
        return _stream(error_stream("Could not read the upload."))

    if len(uploads) > MAX_FILES:
        return _stream(error_stream(f"Too many files (max {MAX_FILES})."))

    inputs: list[InputFile] = []
    for upload in uploads:
        data = await upload.read()
        if len(data) > MAX_FILE_BYTES:
            return _stream(error_stream(f'"{upload.filename}" exceeds the 25MB limit.'))
        inputs.append(
            InputFile(name=upload.filename or "upload", mime=_resolve_mime(upload), data=data)
        )

    logger.info("route.run", files=len(inputs), has_message=bool(message), task_id=task_id)
    return _stream(run_pipeline_stream(inputs, message))
