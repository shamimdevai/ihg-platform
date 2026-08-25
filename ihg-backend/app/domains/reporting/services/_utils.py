"""Internal helper shared between reporting's own service modules. Not part of any
public cross-domain contract — only used within app/domains/reporting/services/*.py.
"""
from datetime import date, datetime, time, timezone
from typing import Optional


def in_date_range(created_at: datetime, date_from: Optional[date], date_to: Optional[date]) -> bool:
    """True if `created_at` (UTC-aware, per every model's TimestampMixin) falls
    within [date_from, date_to] inclusive. Either bound may be None (open-ended).
    """
    if date_from is not None:
        start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        if created_at < start:
            return False
    if date_to is not None:
        end = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
        if created_at > end:
            return False
    return True