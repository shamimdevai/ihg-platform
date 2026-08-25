"""add restaurant domain tables (Phase 8)

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: Union[str, None] = "0007"
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
        "restaurants",
        *_soft_delete_columns(),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "dining_tables",
        *_soft_delete_columns(),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("table_number", sa.String(length=20), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="available"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("restaurant_id", "table_number", name="uq_table_restaurant_number"),
    )
    op.create_index("ix_dining_tables_restaurant_id", "dining_tables", ["restaurant_id"])

    op.create_table(
        "table_reservations",
        *_soft_delete_columns(),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dining_tables.id"), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("customer_name", sa.String(length=200), nullable=False),
        sa.Column("customer_phone", sa.String(length=30), nullable=True),
        sa.Column("reservation_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="reserved"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("booked_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_table_reservations_restaurant_id", "table_reservations", ["restaurant_id"])
    op.create_index("ix_table_reservations_table_id", "table_reservations", ["table_id"])
    op.create_index("ix_table_reservations_customer_id", "table_reservations", ["customer_id"])

    op.create_table(
        "menu_categories",
        *_soft_delete_columns(),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_menu_categories_restaurant_id", "menu_categories", ["restaurant_id"])

    op.create_table(
        "menu_items",
        *_soft_delete_columns(),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("menu_categories.id"), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("inventory_item_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("inventory_qty_per_unit", sa.Numeric(10, 3), nullable=True),
    )
    op.create_index("ix_menu_items_restaurant_id", "menu_items", ["restaurant_id"])
    op.create_index("ix_menu_items_category_id", "menu_items", ["category_id"])

    op.create_table(
        "dine_in_orders",
        *_soft_delete_columns(),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id"), nullable=False),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dining_tables.id"), nullable=False),
        sa.Column("reservation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("table_reservations.id"), nullable=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="placed"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("placed_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_dine_in_orders_restaurant_id", "dine_in_orders", ["restaurant_id"])
    op.create_index("ix_dine_in_orders_table_id", "dine_in_orders", ["table_id"])
    op.create_index("ix_dine_in_orders_reservation_id", "dine_in_orders", ["reservation_id"])
    op.create_index("ix_dine_in_orders_customer_id", "dine_in_orders", ["customer_id"])

    op.create_table(
        "dine_in_order_items",
        *_soft_delete_columns(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dine_in_orders.id"), nullable=False),
        sa.Column("menu_item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("menu_items.id"), nullable=False),
        sa.Column("item_name", sa.String(length=150), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("special_instructions", sa.Text(), nullable=True),
    )
    op.create_index("ix_dine_in_order_items_order_id", "dine_in_order_items", ["order_id"])
    op.create_index("ix_dine_in_order_items_menu_item_id", "dine_in_order_items", ["menu_item_id"])

    op.create_table(
        "waiter_assignments",
        *_soft_delete_columns(),
        sa.Column("table_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dining_tables.id"), nullable=False),
        sa.Column("staff_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("unassigned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_waiter_assignments_table_id", "waiter_assignments", ["table_id"])
    op.create_index("ix_waiter_assignments_staff_id", "waiter_assignments", ["staff_id"])

    op.create_table(
        "kitchen_tickets",
        *_soft_delete_columns(),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dine_in_orders.id"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("served_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_kitchen_tickets_order_id", "kitchen_tickets", ["order_id"], unique=True)


def downgrade() -> None:
    op.drop_table("kitchen_tickets")
    op.drop_table("waiter_assignments")
    op.drop_table("dine_in_order_items")
    op.drop_table("dine_in_orders")
    op.drop_table("menu_items")
    op.drop_table("menu_categories")
    op.drop_table("table_reservations")
    op.drop_table("dining_tables")
    op.drop_table("restaurants")