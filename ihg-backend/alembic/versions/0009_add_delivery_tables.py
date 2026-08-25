"""add delivery domain tables (Phase 9)

Revision ID: 0009
Revises: 0008
Create Date: 2026-08-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _soft_delete_columns():
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
    ]


def upgrade() -> None:
    op.create_table(
        "delivery_riders",
        *_soft_delete_columns(),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vehicle_type", sa.String(length=30), nullable=True),
        sa.Column("license_plate", sa.String(length=30), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="offline"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_delivery_riders_staff_id", "delivery_riders", ["staff_id"], unique=True)

    op.create_table(
        "delivery_orders",
        *_soft_delete_columns(),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("delivery_address_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="placed"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("delivery_fee", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("delivery_notes", sa.Text(), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("out_for_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_delivery_orders_customer_id", "delivery_orders", ["customer_id"])
    op.create_index("ix_delivery_orders_delivery_address_id", "delivery_orders", ["delivery_address_id"])
    op.create_index("ix_delivery_orders_restaurant_id", "delivery_orders", ["restaurant_id"])

    op.create_table(
        "delivery_order_items",
        *_soft_delete_columns(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_orders.id"), nullable=False),
        sa.Column("menu_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("item_name", sa.String(length=150), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("special_instructions", sa.Text(), nullable=True),
    )
    op.create_index("ix_delivery_order_items_order_id", "delivery_order_items", ["order_id"])
    op.create_index("ix_delivery_order_items_menu_item_id", "delivery_order_items", ["menu_item_id"])

    op.create_table(
        "delivery_assignments",
        *_soft_delete_columns(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_orders.id"), nullable=False),
        sa.Column("rider_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("delivery_riders.id"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="assigned"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("assigned_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_delivery_assignments_order_id", "delivery_assignments", ["order_id"])
    op.create_index("ix_delivery_assignments_rider_id", "delivery_assignments", ["rider_id"])


def downgrade() -> None:
    op.drop_table("delivery_assignments")
    op.drop_table("delivery_order_items")
    op.drop_table("delivery_orders")
    op.drop_table("delivery_riders")