"""In-memory fixed-window rate limiter applied only to routes containing "/auth/".

In-memory only — not safe across multiple worker processes/instances. Acceptable for
this phase (single api process, no Redis yet per Open Decisions #3); revisit once
Celery/Redis is introduced and move this to a Redis-backed limiter.
"""
import time
from collections import defaultdict
from typing import Dict, List

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.shared_kernel.schemas.response_envelope import envelope

_WINDOW_SECONDS = 60

# client_key -> list of request timestamps within the current window
_request_log: Dict[str, List[float]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Throttles requests to any path containing "/auth/" per client IP."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if "/auth/" not in request.url.path:
            return await call_next(request)

        client_key = request.client.host if request.client else "unknown"
        now = time.time()

        window_start = now - _WINDOW_SECONDS
        _request_log[client_key] = [t for t in _request_log[client_key] if t > window_start]

        if len(_request_log[client_key]) >= settings.AUTH_RATE_LIMIT_PER_MINUTE:
            return JSONResponse(
                status_code=429,
                content=envelope(message="Too many requests. Please try again shortly.", success=False),
            )

        _request_log[client_key].append(now)
        return await call_next(request)