"""Writes staff actions to iam.audit_log for every mutating request.

INTENTIONAL EXCEPTION to shared_kernel's usual domain-agnostic rule: this file imports
app.domains.iam.services.audit_service (a service call, not a model import — the
layering rule is respected) because PROJECT_STATE.md §5 explicitly documents this
middleware as writing to iam.audit_log. The import is deferred to inside dispatch() to
avoid a hard module-load-order dependency between shared_kernel and iam.

Runs in its own database session (separate from the request's get_db-managed session)
since middleware sits outside normal FastAPI dependency injection. Audit-write
failures are logged and swallowed — an audit logging failure must never break the
actual request.
"""
import logging
from typing import Optional
from uuid import UUID

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.security import decode_access_token
from app.db.connection import AsyncSessionLocal

logger = logging.getLogger("ihg_platform.audit")

_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _extract_staff_id(request: Request) -> Optional[UUID]:
    """Best-effort extraction of the acting staff_user_id from the Authorization header.
    Returns None for missing/invalid/non-staff tokens — audit_log.staff_user_id is
    nullable specifically to allow this.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[len("Bearer "):]
    try:
        payload = decode_access_token(token)
    except Exception:
        return None
    if payload.get("principal_type") != "staff":
        return None
    try:
        return UUID(payload.get("sub"))
    except (TypeError, ValueError):
        return None


class AuditMiddleware(BaseHTTPMiddleware):
    """Logs every mutating request to iam.audit_log."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        if request.method in _MUTATING_METHODS:
            staff_id = _extract_staff_id(request)
            try:
                from app.domains.iam.services import audit_service

                async with AsyncSessionLocal() as session:
                    await audit_service.log_action(
                        session,
                        staff_user_id=staff_id,
                        action=f"{request.method} {request.url.path}",
                        metadata={"status_code": response.status_code},
                    )
                    await session.commit()
            except Exception:
                logger.exception(
                    "Failed to write audit log entry for %s %s", request.method, request.url.path
                )
        return response