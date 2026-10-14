"""Application-wide settings loaded from environment variables.

Framework-level configuration only (DB URL, JWT secrets, upload paths, SMTP, etc.).
Static per-deployment branding lives in config/company.yaml and is loaded separately
by app.core.company_config — never merge the two.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed representation of all required environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # App
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_SECRET_KEY: str
    APP_BASE_URL: str = "http://localhost:80"

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Uploads
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 5

    # Email (SMTP) — dev points at Mailpit, prod at a real provider; no code branch, only .env differs
    SMTP_HOST: str = "mailpit"
    SMTP_PORT: int = 1025
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@ihg-platform.com"
    SMTP_USE_TLS: bool = False

    # Celery / Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # CORS
    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000"

    # Rate limiting
    AUTH_RATE_LIMIT_PER_MINUTE: int = 5

    # Idempotency
    IDEMPOTENCY_KEY_TTL_SECONDS: int = 86400

    # Payments — simulated gateway webhook (Phase 6.5). Mock shared-secret check
    # only, not a real provider signature scheme (Stripe/bKash/SSLCommerz each use
    # their own HMAC format) — see app/domains/payments/api/payments.py. Has a
    # default so existing .env files don't break; override in production.
    PAYMENTS_WEBHOOK_SECRET: str = "mock-webhook-secret-change-me"

    # Company branding config path
    COMPANY_CONFIG_PATH: str = "config/company.yaml"

    @property
    def cors_origins_list(self) -> List[str]:
        """Return CORS_ALLOWED_ORIGINS as a parsed list of origins."""
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (read once per process)."""
    return Settings()


settings = get_settings()