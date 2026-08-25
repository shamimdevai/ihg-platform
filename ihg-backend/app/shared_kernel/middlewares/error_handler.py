"""Global exception handlers mapping AppError (and its subclasses) to HTTP responses.

Registered on the FastAPI app in app.main via `register_exception_handlers(app)`.
"""
import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import AppError
from app.shared_kernel.schemas.response_envelope import envelope

logger = logging.getLogger("ihg_platform.error_handler")


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Handle any AppError subclass raised from services/repositories."""
    logger.warning("AppError on %s %s: %s", request.method, request.url.path, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope(data=exc.details, message=exc.message, success=False),
    )


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic/FastAPI request validation errors with the standard envelope."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=envelope(data=exc.errors(), message="Request validation failed.", success=False),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all — never leak raw tracebacks to clients."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=envelope(message="An unexpected error occurred.", success=False),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach all global exception handlers to the FastAPI app instance."""
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)