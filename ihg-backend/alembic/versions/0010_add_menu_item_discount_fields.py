"""add menu item discount fields

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("discount_type", sa.String(length=20), nullable=True))
    op.add_column("menu_items", sa.Column("discount_value", sa.Numeric(12, 2), nullable=True))
    op.add_column("menu_items", sa.Column("discount_starts_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("menu_items", sa.Column("discount_ends_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("menu_items", "discount_ends_at")
    op.drop_column("menu_items", "discount_starts_at")
    op.drop_column("menu_items", "discount_value")
    op.drop_column("menu_items", "discount_type")