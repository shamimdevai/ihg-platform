"""Custom exception hierarchy used across the application.

Raise these from services/ (or deeper) instead of raising HTTPException directly, so
error handling stays consistent and is mapped to HTTP responses in one place:
app/shared_kernel/middlewares/error_handler.py.
"""
from typing import Any, Optional


class AppError(Exception):
    """Base class for all application-raised errors."""

    status_code: int = 500
    default_message: str = "An unexpected error occurred."

    def __init__(self, message: Optional[str] = None, *, details: Optional[Any] = None) -> None:
        self.message = message or self.default_message
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppError):
    """Raised when a requested resource does not exist."""
    status_code = 404
    default_message = "Resource not found."


class ValidationError(AppError):
    """Raised when input fails a business-rule validation (distinct from schema validation)."""
    status_code = 422
    default_message = "Validation failed."


class PermissionDeniedError(AppError):
    """Raised when the current principal lacks permission for the requested action."""
    status_code = 403
    default_message = "You do not have permission to perform this action."


class UnauthorizedError(AppError):
    """Raised when authentication is missing, invalid, or expired."""
    status_code = 401
    default_message = "Authentication required."


class ConflictError(AppError):
    """Raised when an action conflicts with the current state (e.g. duplicate email)."""
    status_code = 409
    default_message = "Request conflicts with the current state of the resource."


class AccountLockedError(AppError):
    """Raised when a staff or customer account is locked due to failed login attempts."""
    status_code = 423
    default_message = "Account is temporarily locked. Please try again later."