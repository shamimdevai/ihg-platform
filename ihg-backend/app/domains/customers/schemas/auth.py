"""Auth-related request/response schemas for customer self-service auth."""
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Payload for POST /customers/auth/register."""

    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str
    last_name: str
    phone: Optional[str] = None


class LoginRequest(BaseModel):
    """Payload for POST /customers/auth/login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Standard token pair returned by register/login/refresh. Kept separate from
    iam.schemas.auth.TokenResponse to keep the customers domain's API contract fully
    independent of iam's.
    """

    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """Payload for POST /customers/auth/refresh."""

    refresh_token: str


class VerifyEmailRequest(BaseModel):
    """Payload for POST /customers/auth/verify-email."""

    token: str


class ResendVerificationRequest(BaseModel):
    """Payload for POST /customers/auth/resend-verification."""

    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """Payload for POST /customers/auth/forgot-password."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload for POST /customers/auth/reset-password."""

    token: str
    new_password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    """Payload for POST /customers/auth/change-password (authenticated)."""

    current_password: str
    new_password: str = Field(min_length=8)