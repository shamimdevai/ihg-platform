"""add image_url to hotels and restaurants

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("hotels", sa.Column("image_url", sa.String(length=500), nullable=True))
    op.add_column("restaurants", sa.Column("image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurants", "image_url")
    op.drop_column("hotels", "image_url")