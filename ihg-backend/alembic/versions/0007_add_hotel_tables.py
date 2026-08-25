"""add hotel domain tables (Phase 7)

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: Union[str, None] = "0006"
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
        "hotels",
        *_soft_delete_columns(),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "room_types",
        *_soft_delete_columns(),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hotels.id"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_rate", sa.Numeric(12, 2), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("amenities", sa.Text(), nullable=True),
    )
    op.create_index("ix_room_types_hotel_id", "room_types", ["hotel_id"])

    op.create_table(
        "rooms",
        *_soft_delete_columns(),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hotels.id"), nullable=False),
        sa.Column("room_type_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("room_types.id"), nullable=False),
        sa.Column("room_number", sa.String(length=20), nullable=False),
        sa.Column("floor", sa.String(length=20), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="available"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("hotel_id", "room_number", name="uq_room_hotel_number"),
    )
    op.create_index("ix_rooms_hotel_id", "rooms", ["hotel_id"])
    op.create_index("ix_rooms_room_type_id", "rooms", ["room_type_id"])

    op.create_table(
        "bookings",
        *_soft_delete_columns(),
        sa.Column("hotel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("hotels.id"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("guest_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("check_in_date", sa.Date(), nullable=False),
        sa.Column("check_out_date", sa.Date(), nullable=False),
        sa.Column("actual_check_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_check_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("num_guests", sa.Integer(), nullable=True),
        sa.Column("rate_per_night", sa.Numeric(12, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="reserved"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cancelled_reason", sa.Text(), nullable=True),
        sa.Column("booked_by_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_bookings_hotel_id", "bookings", ["hotel_id"])
    op.create_index("ix_bookings_room_id", "bookings", ["room_id"])
    op.create_index("ix_bookings_guest_id", "bookings", ["guest_id"])

    op.create_table(
        "housekeeping_tasks",
        *_soft_delete_columns(),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=True),
        sa.Column("task_type", sa.String(length=30), nullable=False, server_default="cleaning"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("assigned_to_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_housekeeping_tasks_room_id", "housekeeping_tasks", ["room_id"])
    op.create_index("ix_housekeeping_tasks_booking_id", "housekeeping_tasks", ["booking_id"])

    op.create_table(
        "invoices",
        *_soft_delete_columns(),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("invoice_number", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("subtotal", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pdf_path", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_invoices_booking_id", "invoices", ["booking_id"])
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"], unique=True)
    op.create_index("ix_invoices_payment_id", "invoices", ["payment_id"])

    op.create_table(
        "invoice_items",
        *_soft_delete_columns(),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("item_type", sa.String(length=30), nullable=False, server_default="room_charge"),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("line_total", sa.Numeric(12, 2), nullable=False),
    )
    op.create_index("ix_invoice_items_invoice_id", "invoice_items", ["invoice_id"])

    op.create_table(
        "service_requests",
        *_soft_delete_columns(),
        sa.Column("booking_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("request_type", sa.String(length=30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("assigned_to_staff_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_service_requests_booking_id", "service_requests", ["booking_id"])
    op.create_index("ix_service_requests_room_id", "service_requests", ["room_id"])


def downgrade() -> None:
    op.drop_table("service_requests")
    op.drop_table("invoice_items")
    op.drop_table("invoices")
    op.drop_table("housekeeping_tasks")
    op.drop_table("bookings")
    op.drop_table("rooms")
    op.drop_table("room_types")
    op.drop_table("hotels")