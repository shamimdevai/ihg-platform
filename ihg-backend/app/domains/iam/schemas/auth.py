"""Auth-related request/response schemas."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Payload for POST /iam/auth/login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Standard token pair returned by login/refresh/impersonate."""

    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    """Payload for POST /iam/auth/refresh."""

    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    """Payload for POST /iam/auth/forgot-password."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Payload for POST /iam/auth/reset-password."""

    token: str
    new_password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    """Payload for POST /iam/auth/change-password (authenticated)."""

    current_password: str
    new_password: str = Field(min_length=8)


class InviteStaffRequest(BaseModel):
    """Payload for POST /iam/staff (creates an inactive account + sends invite email)."""

    email: EmailStr
    first_name: str
    last_name: str
    role_id: UUID
    department_id: Optional[UUID] = None


class AcceptInviteRequest(BaseModel):
    """Payload for POST /iam/auth/accept-invite — public, unauthenticated."""

    token: str
    new_password: str = Field(min_length=8)