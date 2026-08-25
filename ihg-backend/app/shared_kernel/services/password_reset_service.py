"""Generic password-reset / staff-invite / email-verification token service.

This service knows NOTHING about staff or customers specifically — it only deals in
principal_type ("staff" | "customer") + principal_id, per PROJECT_STATE.md §3 rule 9 and
Open Decisions #13. Both app.domains.iam.services.auth_service (Phase 3) and
app.domains.customers.services.customer_auth_service (Phase 4) call these three functions
directly; do not duplicate token logic in either domain.

Raw tokens are only ever returned once, at generation time (embedded in an emailed link).
Only a SHA-256 hash of the token is ever persisted, so a database leak alone cannot be
used to reset an account.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.shared_kernel.models.password_reset_token import PasswordResetToken
from app.shared_kernel.repositories import password_reset_token_repository

PrincipalType = Literal["staff", "customer"]
TokenPurpose = Literal["reset", "invite", "verify_email"]

DEFAULT_EXPIRY_MINUTES = 60


def _hash_token(raw_token: str) -> str:
    """Deterministically hash a raw token for storage/lookup (SHA-256, hex-encoded)."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def generate_token(
    db: AsyncSession,
    *,
    principal_type: PrincipalType,
    principal_id: UUID,
    purpose: TokenPurpose,
    expires_in_minutes: int = DEFAULT_EXPIRY_MINUTES,
) -> str:
    """Generate a new token for the given principal + purpose.

    Returns the RAW token string — this is the only time it is available in plaintext.
    Only its SHA-256 hash is stored. Callers (iam.auth_service /
    customers.customer_auth_service) are responsible for embedding this raw value in the
    emailed link and never persisting it themselves.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)

    await password_reset_token_repository.create(
        db,
        principal_type=principal_type,
        principal_id=principal_id,
        token_hash=token_hash,
        purpose=purpose,
        expires_at=expires_at,
    )
    return raw_token


async def validate_token(
    db: AsyncSession,
    *,
    raw_token: str,
    purpose: TokenPurpose,
) -> PasswordResetToken:
    """Validate a raw token without consuming it.

    Raises:
        NotFoundError: token does not exist, or its purpose doesn't match.
        ConflictError: token was already used.
        ValidationError: token has expired.

    Returns:
        The matching PasswordResetToken record (still unconsumed).
    """
    token_hash = _hash_token(raw_token)
    token = await password_reset_token_repository.get_by_token_hash(db, token_hash)

    if token is None or token.purpose != purpose:
        raise NotFoundError("Invalid or unrecognized token.")

    if token.used_at is not None:
        raise ConflictError("This token has already been used.")

    if token.expires_at < datetime.now(timezone.utc):
        raise ValidationError("This token has expired.")

    return token


async def consume_token(
    db: AsyncSession,
    *,
    raw_token: str,
    purpose: TokenPurpose,
) -> PasswordResetToken:
    """Validate a raw token and mark it used in a single call (one-time use).

    Raises the same exceptions as `validate_token`. Callers should call this only once
    they are certain the associated action (password reset, invite completion, email
    verification) will actually be applied, since the token cannot be un-consumed.

    Returns:
        The now-consumed PasswordResetToken record, so the caller can read
        `principal_type` / `principal_id` to know which account to act on.
    """
    token = await validate_token(db, raw_token=raw_token, purpose=purpose)
    return await password_reset_token_repository.mark_used(db, token)