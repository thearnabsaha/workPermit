"""Central runtime configuration.

All environment access funnels through here so the rest of the code stays
testable and the hybrid real/mock behavior is decided in one place.
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


def _env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.environ.get(name)
        if value and value.strip():
            return value.strip()
    return default


class Config:
    # Gemini API key (the only paid dependency). Accept common env names.
    gemini_api_key: str = _env(
        "GOOGLE_API_KEY", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"
    )

    # Gemini chat model (multimodal - also used for image OCR).
    gemini_model: str = _env("GEMINI_MODEL", default="gemini-2.5-flash")

    # Gemini embedding model for duplicate/similarity detection.
    embedding_model: str = _env("GEMINI_EMBEDDING_MODEL", default="text-embedding-004")

    # Force the deterministic mock pipeline even if a key is present.
    force_mock: bool = _env("FORCE_MOCK") == "1"

    # CORS origin for the Next.js frontend.
    frontend_origin: str = _env("FRONTEND_ORIGIN", default="http://localhost:3000")


config = Config()


def has_gemini() -> bool:
    """True when the real Gemini path should be used."""
    return (not config.force_mock) and len(config.gemini_api_key) > 0
