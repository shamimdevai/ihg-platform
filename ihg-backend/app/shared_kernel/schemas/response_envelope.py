"""The standard {success, message, data, meta} response envelope used by every endpoint."""
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ResponseEnvelope(BaseModel, Generic[T]):
    """Typed envelope model — usable as a FastAPI `response_model` in future domains."""

    success: bool = True
    message: str = ""
    data: Optional[T] = None
    meta: Optional[dict] = None


def envelope(data: Any = None, message: str = "", meta: Optional[dict] = None, success: bool = True) -> dict:
    """Build a plain-dict response envelope (convenience helper for simple endpoints)."""
    return {"success": success, "message": message, "data": data, "meta": meta}