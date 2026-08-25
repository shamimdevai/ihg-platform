"""CustomerFavorite — a saved menu item, foundation for future personalized
recommendations (Part C.6 of the traceability doc). menu_item_id intentionally carries
NO ForeignKey — the restaurant domain doesn't exist yet (Phase 8), and even once it
does, cross-domain models may never be imported by another domain per the layering rule.
"""
import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class CustomerFavorite(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single saved menu item for a customer."""

    __tablename__ = "customer_favorites"
    __table_args__ = (UniqueConstraint("customer_id", "menu_item_id", name="uq_customer_favorite"),)

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True
    )
    menu_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)