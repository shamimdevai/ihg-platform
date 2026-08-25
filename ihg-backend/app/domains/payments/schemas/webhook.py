"""Request schema for the simulated payment gateway webhook.

This is a MOCK webhook (Phase 6.5 scope) — it validates a shared-secret header
rather than a real provider's signature scheme (Stripe/bKash/SSLCommerz each use
their own HMAC/signature format), so it can prove out the request-handling pattern
without being tied to a specific provider's SDK or credentials.
"""
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel


class WebhookEventRequest(BaseModel):
    """Payload for POST /payments/webhook — a simulated gateway event."""

    event_type: Literal["payment.succeeded", "payment.failed", "payment.refunded"]
    payment_id: UUID
    failure_reason: Optional[str] = None
    refund_reason: Optional[str] = None