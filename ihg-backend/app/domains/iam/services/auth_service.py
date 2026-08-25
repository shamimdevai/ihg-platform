"""Staff authentication: login, refresh, logout, logout-all, forgot/reset/change
password. Lockout policy and password policy are read from the DB-backed
settings_service (dynamic tier) with sane defaults if unset.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AccountLockedError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.core.security import (
    create_access_token,
    generate_opaque_token,
    hash_opaque_token,
    hash_password,
    verify_password,
)
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.repositories import staff_session_repository, staff_user_repository
from app.domains.iam.schemas.auth import TokenResponse
from app.domains.settings.services import settings_service
from app.shared_kernel.services import password_reset_service


async def _get_lockout_policy(db: AsyncSession) -> tuple[int, int]:
    """Return (max_attempts, lockout_duration_minutes) from settings, with defaults."""
    max_attempts = await settings_service.get_setting(db, "account_lockout_max_attempts", default=5)
    duration = await settings_service.get_setting(db, "account_lockout_duration_minutes", default=15)
    return int(max_attempts), int(duration)


async def validate_password_policy(db: AsyncSession, password: str) -> None:
    """Validate a candidate password against the dynamic password policy settings.

    Raises:
        ValidationError: password fails one or more policy rules.
    """
    min_length = int(await settings_service.get_setting(db, "password_min_length", default=8))
    require_upper = bool(await settings_service.get_setting(db, "password_require_uppercase", default=True))
    require_number = bool(await settings_service.get_setting(db, "password_require_number", default=True))

    if len(password) < min_length:
        raise ValidationError(f"Password must be at least {min_length} characters long.")
    if require_upper and not re.search(r"[A-Z]", password):
        raise ValidationError("Password must contain at least one uppercase letter.")
    if require_number and not re.search(r"\d", password):
        raise ValidationError("Password must contain at least one digit.")


def _issue_token_pair(staff: StaffUser) -> tuple[str, str]:
    """Create a fresh (access_token, raw_refresh_token) pair. Does not persist anything."""
    access_token = create_access_token(
        subject=staff.id,
        principal_type="staff",
        extra_claims={"is_superadmin": staff.is_superadmin},
    )
    raw_refresh_token = generate_opaque_token()
    return access_token, raw_refresh_token


async def login(
    db: AsyncSession, *, email: str, password: str, device_info: Optional[str] = None
) -> TokenResponse:
    """Authenticate a staff member and issue a new token pair + session.

    Raises:
        UnauthorizedError: unknown email, inactive account, or wrong password.
        AccountLockedError: account is currently locked, or this failure just locked it.
    """
    staff = await staff_user_repository.get_by_email(db, email)
    if staff is None or not staff.is_active:
        raise UnauthorizedError("Invalid email or password.")

    now = datetime.now(timezone.utc)
    if staff.locked_until is not None and staff.locked_until > now:
        raise AccountLockedError()

    if staff.password_hash is None or not verify_password(password, staff.password_hash):
        max_attempts, duration_minutes = await _get_lockout_policy(db)
        staff.failed_login_attempts += 1
        if staff.failed_login_attempts >= max_attempts:
            staff.locked_until = now + timedelta(minutes=duration_minutes)
            await staff_user_repository.save(db, staff)
            raise AccountLockedError(
                f"Account locked after {max_attempts} failed attempts. Try again in {duration_minutes} minutes."
            )
        await staff_user_repository.save(db, staff)
        raise UnauthorizedError("Invalid email or password.")

    staff.failed_login_attempts = 0
    staff.locked_until = None
    staff.last_login_at = now
    await staff_user_repository.save(db, staff)

    access_token, raw_refresh_token = _issue_token_pair(staff)
    expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    await staff_session_repository.create(
        db,
        staff_user_id=staff.id,
        refresh_token_hash=hash_opaque_token(raw_refresh_token),
        expires_at=expires_at,
        device_info=device_info,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def refresh(db: AsyncSession, *, raw_refresh_token: str) -> TokenResponse:
    """Exchange a valid refresh token for a new token pair. Rotates the refresh token
    (old session is revoked, a new one is created) to limit reuse-window exposure.

    Raises:
        UnauthorizedError: token unknown, revoked, or expired.
    """
    token_hash = hash_opaque_token(raw_refresh_token)
    session = await staff_session_repository.get_by_token_hash(db, token_hash)

    now = datetime.now(timezone.utc)
    if session is None or session.revoked_at is not None or session.expires_at < now:
        raise UnauthorizedError("Invalid or expired refresh token.")

    staff = await staff_user_repository.get_by_id(db, session.staff_user_id)
    if staff is None or not staff.is_active:
        raise UnauthorizedError("Account is no longer active.")

    await staff_session_repository.revoke(db, session)

    access_token, new_raw_refresh_token = _issue_token_pair(staff)
    expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    await staff_session_repository.create(
        db,
        staff_user_id=staff.id,
        refresh_token_hash=hash_opaque_token(new_raw_refresh_token),
        expires_at=expires_at,
        device_info=session.device_info,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_raw_refresh_token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def logout(db: AsyncSession, *, raw_refresh_token: str) -> None:
    """Revoke a single session by its refresh token. Silently no-ops if unknown."""
    token_hash = hash_opaque_token(raw_refresh_token)
    session = await staff_session_repository.get_by_token_hash(db, token_hash)
    if session is not None and session.revoked_at is None:
        await staff_session_repository.revoke(db, session)


async def logout_all(db: AsyncSession, *, staff_user_id: UUID) -> int:
    """Revoke every active session for a staff user. Returns the count revoked."""
    return await staff_session_repository.revoke_all_for_staff(db, staff_user_id)


async def forgot_password(db: AsyncSession, *, email: str) -> None:
    """Send a password reset email if the address matches an active staff account.

    Deliberately does not reveal whether the email exists (silently succeeds either
    way) to avoid account enumeration.
    """
    from app.shared_kernel.services import email_service  # local import: avoids a
    # module-load-time cycle between auth_service and email_service in some import orders

    staff = await staff_user_repository.get_by_email(db, email)
    if staff is None or not staff.is_active:
        return

    raw_token = await password_reset_service.generate_token(
        db, principal_type="staff", principal_id=staff.id, purpose="reset"
    )
    reset_link = f"{settings.APP_BASE_URL}/reset-password?token={raw_token}"
    await email_service.send_email(
        to_email=staff.email,
        subject="Reset your password",
        template_name="password_reset.html",
        context={"recipient_name": staff.first_name, "reset_link": reset_link},
    )


async def reset_password(db: AsyncSession, *, token: str, new_password: str) -> None:
    """Consume a "reset" token and set a new password. Revokes all sessions afterward
    for security, forcing re-login everywhere.

    Raises:
        NotFoundError / ConflictError / ValidationError: from password_reset_service.
        NotFoundError: the token's principal_id no longer matches a staff account.
    """
    await validate_password_policy(db, new_password)
    consumed = await password_reset_service.consume_token(db, raw_token=token, purpose="reset")

    staff = await staff_user_repository.get_by_id(db, consumed.principal_id)
    if staff is None:
        raise NotFoundError("Associated staff account no longer exists.")

    staff.password_hash = hash_password(new_password)
    staff.failed_login_attempts = 0
    staff.locked_until = None
    await staff_user_repository.save(db, staff)
    await staff_session_repository.revoke_all_for_staff(db, staff.id)


async def change_password(
    db: AsyncSession, *, staff_user_id: UUID, current_password: str, new_password: str
) -> None:
    """Change an authenticated staff member's password after verifying the current one.

    Raises:
        UnauthorizedError: current_password is incorrect.
        ValidationError: new_password fails policy.
    """
    staff = await staff_user_repository.get_by_id(db, staff_user_id)
    if staff is None or staff.password_hash is None or not verify_password(current_password, staff.password_hash):
        raise UnauthorizedError("Current password is incorrect.")

    await validate_password_policy(db, new_password)
    staff.password_hash = hash_password(new_password)
    await staff_user_repository.save(db, staff)


async def get_current_staff(db: AsyncSession, token: str) -> StaffUser:
    """Decode a JWT access token and return the corresponding active StaffUser.

    Used by app.api.v1.deps.get_current_staff_user — the single entry point every
    protected endpoint depends on.

    Raises:
        UnauthorizedError: token invalid/expired, wrong principal_type, or account
            inactive/deleted/no longer exists.
    """
    from app.core.security import decode_access_token

    payload = decode_access_token(token)
    if payload.get("principal_type") != "staff":
        raise UnauthorizedError("Invalid token principal.")

    try:
        staff_id = UUID(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise UnauthorizedError("Invalid token subject.") from exc

    staff = await staff_user_repository.get_by_id(db, staff_id)
    if staff is None or not staff.is_active:
        raise UnauthorizedError("Account is inactive or no longer exists.")
    return staff