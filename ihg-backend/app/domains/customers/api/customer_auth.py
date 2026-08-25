"""Customer self-service authentication endpoints."""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_customer, get_db
from app.domains.customers.models.customer import Customer
from app.domains.customers.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.domains.customers.schemas.customer import CustomerRead
from app.domains.customers.services import customer_auth_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/customers/auth", tags=["customer-auth"])


@router.post("/register")
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Self-register a new customer account and send a verification email."""
    customer = await customer_auth_service.register(
        db,
        email=payload.email,
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
    )
    return envelope(
        data=CustomerRead.model_validate(customer),
        message="Account created. Please check your email to verify your address.",
    )


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Verify a customer's email address using a "verify_email"-purpose token."""
    customer = await customer_auth_service.verify_email(db, token=payload.token)
    return envelope(data=CustomerRead.model_validate(customer), message="Email verified.")


@router.post("/resend-verification")
async def resend_verification(payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Resend the verification email for an unverified account."""
    await customer_auth_service.resend_verification(db, email=payload.email)
    return envelope(message="If that email exists and is unverified, a new link has been sent.")


@router.post("/login")
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)) -> dict:
    """Authenticate with email + password. Does not require a verified email."""
    device_info = request.headers.get("User-Agent")
    tokens = await customer_auth_service.login(
        db, email=payload.email, password=payload.password, device_info=device_info
    )
    return envelope(data=tokens, message="Login successful.")


@router.post("/refresh")
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Exchange a refresh token for a new token pair."""
    tokens = await customer_auth_service.refresh(db, raw_refresh_token=payload.refresh_token)
    return envelope(data=tokens, message="Token refreshed.")


@router.post("/logout")
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Revoke a single session by its refresh token."""
    await customer_auth_service.logout(db, raw_refresh_token=payload.refresh_token)
    return envelope(message="Logged out.")


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Send a password reset email if the address matches an active account."""
    await customer_auth_service.forgot_password(db, email=payload.email)
    return envelope(message="If that email exists, a reset link has been sent.")


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Reset a password using a "reset"-purpose token."""
    await customer_auth_service.reset_password(db, token=payload.token, new_password=payload.new_password)
    return envelope(message="Password has been reset. Please log in again.")


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Change the current customer's password."""
    await customer_auth_service.change_password(
        db,
        customer_id=customer.id,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return envelope(message="Password changed successfully.")