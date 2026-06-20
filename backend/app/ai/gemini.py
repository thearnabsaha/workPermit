"""Thin LangChain wrappers around Gemini.

The rest of the app talks to these helpers, never to the SDK directly, so the
model is swappable in one place.
"""
from __future__ import annotations

import base64
import math
from typing import List, Optional, Type, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

from ..config import config
from ..logger import logger

T = TypeVar("T", bound=BaseModel)

_chat = None
_embeddings = None


def get_chat_model():
    global _chat
    if _chat is None:
        from langchain_google_genai import ChatGoogleGenerativeAI

        _chat = ChatGoogleGenerativeAI(
            model=config.gemini_model,
            google_api_key=config.gemini_api_key,
            temperature=0,
            max_retries=2,
        )
    return _chat


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        _embeddings = GoogleGenerativeAIEmbeddings(
            model=config.embedding_model, google_api_key=config.gemini_api_key
        )
    return _embeddings


def generate_structured(
    schema: Type[T],
    user: str,
    system: str = "Respond with valid JSON only.",
    images: Optional[List[str]] = None,
) -> T:
    """Call Gemini and validate the JSON response against a Pydantic schema.

    Retries once on failure. Raises if it still cannot produce a valid object
    (the caller then falls back to the deterministic mock).
    """
    model = get_chat_model().with_structured_output(schema)

    def build_human(extra: str = "") -> HumanMessage:
        if images:
            content: list = [{"type": "text", "text": user + extra}]
            for url in images:
                content.append({"type": "image_url", "image_url": url})
            return HumanMessage(content=content)
        return HumanMessage(content=user + extra)

    last_err: Optional[Exception] = None
    for attempt in range(2):
        extra = "" if attempt == 0 else "\n\nYour previous answer was invalid. Respond again with ONLY the JSON object."
        try:
            result = model.invoke([SystemMessage(content=system), build_human(extra)])
            if isinstance(result, schema):
                return result
            return schema.model_validate(result)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            logger.warn("gemini.structured_failed", attempt=attempt, error=str(exc))
    raise RuntimeError(f"Gemini did not return a schema-valid response: {last_err}")


def vision_ocr(image_bytes: bytes, mime: str, prompt: str) -> str:
    """Transcribe text from an image using Gemini's multimodal vision."""
    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64}"
    message = HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": data_url},
        ]
    )
    result = get_chat_model().invoke([message])
    content = result.content
    if isinstance(content, list):
        return "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content).strip()
    return str(content or "").strip()


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Cosine similarity for embedding vectors (duplicate/similarity detection)."""
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
