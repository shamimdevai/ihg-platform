"""Customer authentication: register, verify-email, resend-verification, login,
refresh, logout, forgot/reset/change password.

DESIGN DECISION (documented since the phase brief could be read two ways): login does
NOT require a verified email. An unverified customer CAN authenticate and receive a
token — the token simply carries `email_verified: false`. What email verification
gates is specific ACTIONS (placing a delivery order), not authentication itself. That
gate is a separate stub dependency, `require_verified_customer()` in
app.api.v1.deps, wired up for real once the Delivery domain exists (Phase 9).

Password policy validation is implemented locally here (reading settings_service
directly) rather than importing iam.services.auth_service.validate_password_policy —
password policy is generic, settings-driven infrastructure, not staff-specific
business logic, so duplicating this small helper avoids an unnecessary customers->iam
service dependency. See Session Summary for this deviation.
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    AccountLockedError,
    ConflictError,
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
from app.domains.customers.models.customer import Customer
from app.domains.customers.repositories import customer_repository, customer_session_repository
from app.domains.customers.schemas.auth import TokenResponse
from app.domains.settings.services import settings_service
from app.shared_kernel.services import email_service, password_reset_service


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


def _issue_token_pair(customer: Customer) -> tuple[str, str]:
    """Create a fresh (access_token, raw_refresh_token) pair. Does not persist anything."""
    access_token = create_access_token(
        subject=customer.id,
        principal_type="customer",
        extra_claims={"email_verified": customer.email_verified_at is not None},
    )
    raw_refresh_token = generate_opaque_token()
    return access_token, raw_refresh_token


async def _send_verification_email(db: AsyncSession, customer: Customer) -> None:
    """Generate a fresh "verify_email" token and email the verification template."""
    raw_token = await password_reset_service.generate_token(
        db, principal_type="customer", principal_id=customer.id, purpose="verify_email"
    )
    verification_link = f"{settings.APP_BASE_URL}/verify-email?token={raw_token}"
    await email_service.send_email(
        to_email=customer.email,
        subject="Verify your email address",
        template_name="email_verification.html",
        context={"recipient_name": customer.first_name, "verification_link": verification_link},
    )


async def register(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    phone: Optional[str] = None,
) -> Customer:
    """Self-register a new customer account and send the verification email.

    Raises:
        ConflictError: a customer account with this email already exists.
        ValidationError: password fails policy.
    """
    existing = await customer_repository.get_by_email(db, email)
    if existing is not None:
        raise ConflictError(f"A customer account with email '{email}' already exists.")

    await validate_password_policy(db, password)

    customer = await customer_repository.create(
        db,
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        phone=phone,
    )
    await _send_verification_email(db, customer)
    return customer


async def resend_verification(db: AsyncSession, *, email: str) -> None:
    """Resend the verification email. Silently no-ops for unknown/already-verified
    accounts to avoid account enumeration.
    """
    customer = await customer_repository.get_by_email(db, email)
    if customer is None or customer.email_verified_at is not None:
        return
    await _send_verification_email(db, customer)


async def verify_email(db: AsyncSession, *, token: str) -> Customer:
    """Consume a "verify_email" token and stamp email_verified_at.

    Raises:
        NotFoundError / ConflictError / ValidationError: from password_reset_service.
        NotFoundError: the token's principal_id no longer matches a customer account.
    """
    consumed = await password_reset_service.consume_token(db, raw_token=token, purpose="verify_email")

    customer = await customer_repository.get_by_id(db, consumed.principal_id)
    if customer is None:
        raise NotFoundError("Associated customer account no longer exists.")

    customer.email_verified_at = datetime.now(timezone.utc)
    return await customer_repository.save(db, customer)


async def login(
    db: AsyncSession, *, email: str, password: str, device_info: Optional[str] = None
) -> TokenResponse:
    """Authenticate a customer and issue a new token pair + session.

    Does NOT require a verified email to succeed — see module docstring. Only
    lockout, active status, and password correctness gate login itself.

    Raises:
        UnauthorizedError: unknown email, inactive account, or wrong password.
        AccountLockedError: account is currently locked, or this failure just locked it.
    """
    customer = await customer_repository.get_by_email(db, email)
    if customer is None or not customer.is_active:
        raise UnauthorizedError("Invalid email or password.")

    now = datetime.now(timezone.utc)
    if customer.locked_until is not None and customer.locked_until > now:
        raise AccountLockedError()

    if not verify_password(password, customer.password_hash):
        max_attempts, duration_minutes = await _get_lockout_policy(db)
        customer.failed_login_attempts += 1
        if customer.failed_login_attempts >= max_attempts:
            customer.locked_until = now + timedelta(minutes=duration_minutes)
            await customer_repository.save(db, customer)
            raise AccountLockedError(
                f"Account locked after {max_attempts} failed attempts. Try again in {duration_minutes} minutes."
            )
        await customer_repository.save(db, customer)
        raise UnauthorizedError("Invalid email or password.")

    customer.failed_login_attempts = 0
    customer.locked_until = None
    customer.last_login_at = now
    await customer_repository.save(db, customer)

    access_token, raw_refresh_token = _issue_token_pair(customer)
    expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    await customer_session_repository.create(
        db,
        customer_id=customer.id,
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
    """Exchange a valid refresh token for a new token pair (rotated).

    Raises:
        UnauthorizedError: token unknown, revoked, or expired.
    """
    token_hash = hash_opaque_token(raw_refresh_token)
    session = await customer_session_repository.get_by_token_hash(db, token_hash)

    now = datetime.now(timezone.utc)
    if session is None or session.revoked_at is not None or session.expires_at < now:
        raise UnauthorizedError("Invalid or expired refresh token.")

    customer = await customer_repository.get_by_id(db, session.customer_id)
    if customer is None or not customer.is_active:
        raise UnauthorizedError("Account is no longer active.")

    await customer_session_repository.revoke(db, session)

    access_token, new_raw_refresh_token = _issue_token_pair(customer)
    expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    await customer_session_repository.create(
        db,
        customer_id=customer.id,
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
    session = await customer_session_repository.get_by_token_hash(db, token_hash)
    if session is not None and session.revoked_at is None:
        await customer_session_repository.revoke(db, session)


async def forgot_password(db: AsyncSession, *, email: str) -> None:
    """Send a password reset email if the address matches an active customer account.
    Silently succeeds either way to avoid account enumeration.
    """
    customer = await customer_repository.get_by_email(db, email)
    if customer is None or not customer.is_active:
        return

    raw_token = await password_reset_service.generate_token(
        db, principal_type="customer", principal_id=customer.id, purpose="reset"
    )
    reset_link = f"{settings.APP_BASE_URL}/reset-password?token={raw_token}"
    await email_service.send_email(
        to_email=customer.email,
        subject="Reset your password",
        template_name="password_reset.html",
        context={"recipient_name": customer.first_name, "reset_link": reset_link},
    )


async def reset_password(db: AsyncSession, *, token: str, new_password: str) -> None:
    """Consume a "reset" token, set a new password, and revoke all sessions.

    Raises:
        NotFoundError / ConflictError / ValidationError: from password_reset_service.
        NotFoundError: the token's principal_id no longer matches a customer account.
    """
    await validate_password_policy(db, new_password)
    consumed = await password_reset_service.consume_token(db, raw_token=token, purpose="reset")

    customer = await customer_repository.get_by_id(db, consumed.principal_id)
    if customer is None:
        raise NotFoundError("Associated customer account no longer exists.")

    customer.password_hash = hash_password(new_password)
    customer.failed_login_attempts = 0
    customer.locked_until = None
    await customer_repository.save(db, customer)
    await customer_session_repository.revoke_all_for_customer(db, customer.id)


async def change_password(
    db: AsyncSession, *, customer_id: UUID, current_password: str, new_password: str
) -> None:
    """Change an authenticated customer's password after verifying the current one.

    Raises:
        UnauthorizedError: current_password is incorrect.
        ValidationError: new_password fails policy.
    """
    customer = await customer_repository.get_by_id(db, customer_id)
    if customer is None or not verify_password(current_password, customer.password_hash):
        raise UnauthorizedError("Current password is incorrect.")

    await validate_password_policy(db, new_password)
    customer.password_hash = hash_password(new_password)
    await customer_repository.save(db, customer)


async def get_current_customer(db: AsyncSession, token: str) -> Customer:
    """Decode a JWT access token and return the corresponding active Customer.

    Used by app.api.v1.deps.get_current_customer — the single entry point every
    customer-protected endpoint depends on.

    Raises:
        UnauthorizedError: token invalid/expired, wrong principal_type, or account
            inactive/deleted/no longer exists.
    """
    from app.core.security import decode_access_token

    payload = decode_access_token(token)
    if payload.get("principal_type") != "customer":
        raise UnauthorizedError("Invalid token principal.")

    try:
        customer_id = UUID(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise UnauthorizedError("Invalid token subject.") from exc

    customer = await customer_repository.get_by_id(db, customer_id)
    if customer is None or not customer.is_active:
        raise UnauthorizedError("Account is inactive or no longer exists.")
    return customer