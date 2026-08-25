"""Password hashing and JWT primitives — framework-level only, no business logic.

Created in Phase 3 to fill a gap from the Phase 1 scaffold (PROJECT_STATE.md §5 lists
this file but it was never actually written). Needed now because IAM auth cannot
function without it.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plaintext password using argon2."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a stored argon2 hash."""
    return _pwd_context.verify(plain_password, password_hash)


def create_access_token(
    *,
    subject: UUID,
    principal_type: str,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Create a signed JWT access token for a staff or customer principal."""
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "principal_type": principal_type,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and verify a JWT access token.

    Raises:
        UnauthorizedError: token is missing, malformed, expired, or has an invalid signature.
    """
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise UnauthorizedError("Invalid or expired token.") from exc


def generate_opaque_token() -> str:
    """Generate a cryptographically random opaque token (used for refresh tokens)."""
    return secrets.token_urlsafe(32)


def hash_opaque_token(raw_token: str) -> str:
    """Deterministically hash an opaque token for storage/lookup (SHA-256, hex)."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()