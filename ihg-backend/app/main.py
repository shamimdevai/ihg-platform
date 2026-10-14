"""FastAPI application factory.

Mounts the /api/v1 router (settings domain endpoints as of Phase 2), the unversioned
/health check, CORS, shared_kernel middlewares, and global exception handlers. Also
loads company_config at startup so a misconfigured config/company.yaml fails fast
instead of at first PDF/email render.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.company_config import company_config
from app.core.config import settings
from app.shared_kernel.api.health import router as health_router
from app.shared_kernel.middlewares.audit_middleware import AuditMiddleware
from app.shared_kernel.middlewares.error_handler import register_exception_handlers
from app.shared_kernel.middlewares.idempotency_middleware import IdempotencyMiddleware
from app.shared_kernel.middlewares.rate_limit_middleware import RateLimitMiddleware
from app.shared_kernel.middlewares.request_logging import RequestLoggingMiddleware


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    app = FastAPI(
        title="IHG Platform API",
        version="0.1.0",
        debug=settings.APP_DEBUG,
    )

    app.state.company_config = company_config

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Order matters: Starlette executes middlewares in reverse of add order for the
    # request path. Idempotency/RateLimit run closest to the route handler; logging
    # wraps everything so duration includes their overhead.
    app.add_middleware(IdempotencyMiddleware)
    app.add_middleware(AuditMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestLoggingMiddleware)

    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(api_router)

    # Serves everything upload_service.py writes under UPLOAD_DIR (menu
    # item images today; hotel invoice PDFs and anything else added
    # later via the same service) — upload_service.save_upload() already
    # returns a "/uploads/..." URL assuming this exact mount exists, but
    # it never did. mkdir here defensively: StaticFiles requires the
    # directory to exist at mount time, and a fresh container may not
    # have written anything yet (upload_service.py only creates its
    # subfolders lazily, on the first actual upload).
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

    return app


app = create_app()