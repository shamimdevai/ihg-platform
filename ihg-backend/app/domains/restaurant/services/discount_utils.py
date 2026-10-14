"""Shared, pure discount-pricing calculation — used by BOTH menu_service.py
(operating on a loaded MenuItem ORM object, for actual order pricing in
dine_in_order_service.py and delivery_order_service.py) AND
schemas/menu.py's MenuItemRead.effective_price computed field (operating on
already-validated Pydantic field values, for display to staff and
customers). Kept as a standalone module with no ORM or Pydantic dependency
of its own, specifically so the formula lives in exactly one place —
neither layer duplicates it, and a future change to the formula can't
silently drift between "what gets charged" and "what gets displayed."
"""
from datetime import datetime, timezone
from typing import Optional


def compute_effective_price(
    *,
    price: float,
    discount_type: Optional[str],
    discount_value: Optional[float],
    discount_starts_at: Optional[datetime],
    discount_ends_at: Optional[datetime],
) -> float:
    """The actual charged/displayed price — `price`, minus any CURRENTLY
    ACTIVE discount. A discount is active only when discount_type and
    discount_value are both set AND, if bounds are set, the current time
    falls within [discount_starts_at, discount_ends_at]. An expired,
    not-yet-started, or unconfigured discount returns the plain base
    price, unchanged.
    """
    if not discount_type or not discount_value:
        return float(price)

    now = datetime.now(timezone.utc)
    if discount_starts_at and now < discount_starts_at:
        return float(price)
    if discount_ends_at and now > discount_ends_at:
        return float(price)

    base = float(price)
    if discount_type == "percentage":
        discounted = base * (1 - float(discount_value) / 100)
    else:  # "fixed_amount"
        discounted = base - float(discount_value)

    # Safety clamp — never negative, never more than the base price. Not
    # a substitute for the create/update-time validation in
    # menu_service.py, just a last-resort guard against a misconfigured
    # value (e.g. a fixed discount somehow larger than price) ever
    # producing a negative charge.
    return max(0.0, min(discounted, base))