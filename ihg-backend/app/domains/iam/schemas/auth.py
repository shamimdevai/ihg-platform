"""Auth-related request/response schemas."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domains.iam.schemas.role import RoleRead


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


class StaffMeRead(BaseModel):
    """Response for GET /iam/auth/me — the current staff member's own profile,
    including their role AND that role's permissions (nested via RoleRead).

    Added to close a real gap: POST /iam/auth/login only returns tokens, and
    GET /iam/staff/{id} / GET /iam/roles/{id} are both permission-gated
    (iam:staff:read / iam:roles:read respectively) — meaning a staff member
    without one of those permissions previously had NO endpoint to call to
    learn their own role or permission list. hasPermission()-style client-side
    nav-gating had nothing to check against for any non-superadmin role that
    doesn't happen to hold iam:staff:read or iam:roles:read (e.g. Waiter,
    Housekeeping, Kitchen, Rider).

    Deliberately gated by authentication only (get_current_staff_user), NOT by
    require_permission — every staff member must be able to ask "who am I /
    what can I do", regardless of what else they're allowed to see.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    department_id: Optional[UUID] = None
    is_active: bool
    is_superadmin: bool
    last_login_at: Optional[datetime] = None
    role: RoleRead