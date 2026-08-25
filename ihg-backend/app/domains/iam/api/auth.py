"""Staff authentication endpoints: login, refresh, logout, logout-all,
forgot/reset/change password, and invite acceptance.
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db
from app.domains.iam.models.staff_user import StaffUser
from app.domains.iam.schemas.auth import (
    AcceptInviteRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
)
from app.domains.iam.services import auth_service, staff_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/iam/auth", tags=["iam-auth"])


@router.post("/login")
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Authenticate with email + password, returning an access/refresh token pair."""
    device_info = request.headers.get("User-Agent")
    tokens = await auth_service.login(
        db, email=payload.email, password=payload.password, device_info=device_info
    )
    return envelope(data=tokens, message="Login successful.")


@router.post("/refresh")
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Exchange a refresh token for a new token pair."""
    tokens = await auth_service.refresh(db, raw_refresh_token=payload.refresh_token)
    return envelope(data=tokens, message="Token refreshed.")


@router.post("/logout")
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Revoke a single session by its refresh token."""
    await auth_service.logout(db, raw_refresh_token=payload.refresh_token)
    return envelope(message="Logged out.")


@router.post("/logout-all")
async def logout_all(
    staff: StaffUser = Depends(get_current_staff_user), db: AsyncSession = Depends(get_db)
) -> dict:
    """Revoke every active session for the current staff member."""
    count = await auth_service.logout_all(db, staff_user_id=staff.id)
    return envelope(data={"sessions_revoked": count}, message="Logged out everywhere.")


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Send a password reset email if the address matches an active account."""
    await auth_service.forgot_password(db, email=payload.email)
    return envelope(message="If that email exists, a reset link has been sent.")


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Reset a password using a "reset"-purpose token."""
    await auth_service.reset_password(db, token=payload.token, new_password=payload.new_password)
    return envelope(message="Password has been reset. Please log in again.")


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change the current staff member's password."""
    await auth_service.change_password(
        db,
        staff_user_id=staff.id,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return envelope(message="Password changed successfully.")


@router.post("/accept-invite")
async def accept_invite(payload: AcceptInviteRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Complete the staff invite flow by setting a password (public, unauthenticated)."""
    await staff_service.accept_invite(db, token=payload.token, new_password=payload.new_password)
    return envelope(message="Invite accepted. You may now log in.")