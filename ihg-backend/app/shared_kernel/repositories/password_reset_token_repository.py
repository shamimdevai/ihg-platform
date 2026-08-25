"""Raw database queries for the password_reset_tokens table. No business logic here."""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared_kernel.models.password_reset_token import PasswordResetToken


async def create(
    db: AsyncSession,
    *,
    principal_type: str,
    principal_id: UUID,
    token_hash: str,
    purpose: str,
    expires_at: datetime,
) -> PasswordResetToken:
    """Insert a new token row."""
    token = PasswordResetToken(
        principal_type=principal_type,
        principal_id=principal_id,
        token_hash=token_hash,
        purpose=purpose,
        expires_at=expires_at,
    )
    db.add(token)
    await db.flush()
    await db.refresh(token)
    return token


async def get_by_token_hash(db: AsyncSession, token_hash: str) -> Optional[PasswordResetToken]:
    """Look up a token by its hash — the only way tokens are ever queried."""
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.is_deleted.is_(False),
        )
    )
    return result.scalar_one_or_none()


async def mark_used(db: AsyncSession, token: PasswordResetToken) -> PasswordResetToken:
    """Stamp used_at on an already-fetched token."""
    token.used_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(token)
    return token