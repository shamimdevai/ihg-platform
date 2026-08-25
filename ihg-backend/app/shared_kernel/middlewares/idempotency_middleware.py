"""Idempotency-Key header support for mutating requests (order/payment creation, etc.).

In-memory cache only for this phase — see rate_limit_middleware.py's note on moving to
Redis once Celery/Redis is introduced (Open Decisions #3). A repeated request with the
same Idempotency-Key + method + path within IDEMPOTENCY_KEY_TTL_SECONDS returns the
cached response instead of re-executing the handler.
"""
import time
from typing import Dict, Tuple

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

_IDEMPOTENCY_HEADER = "Idempotency-Key"

# (method, path, key) -> (expires_at, status_code, body_bytes, media_type)
_cache: Dict[Tuple[str, str, str], Tuple[float, int, bytes, str]] = {}


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Caches responses to mutating requests keyed by the Idempotency-Key header."""

    async def dispatch(self, request: Request, call_next) -> Response:
        idempotency_key = request.headers.get(_IDEMPOTENCY_HEADER)
        if not idempotency_key or request.method not in {"POST", "PUT", "PATCH"}:
            return await call_next(request)

        cache_key = (request.method, request.url.path, idempotency_key)
        cached = _cache.get(cache_key)
        now = time.time()

        if cached and cached[0] > now:
            _, status_code, body, media_type = cached
            return Response(content=body, status_code=status_code, media_type=media_type)

        response = await call_next(request)

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        expires_at = now + settings.IDEMPOTENCY_KEY_TTL_SECONDS
        _cache[cache_key] = (
            expires_at,
            response.status_code,
            body,
            response.media_type or "application/json",
        )

        return Response(content=body, status_code=response.status_code, media_type=response.media_type)