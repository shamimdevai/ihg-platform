"""add iam domain tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
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
    op.create_table("departments", *_soft_delete_columns(), sa.Column("name", sa.String(length=100), nullable=False), sa.Column("description", sa.Text(), nullable=True))
    op.create_index("ix_departments_name", "departments", ["name"], unique=True)

    op.create_table("roles", *_soft_delete_columns(), sa.Column("name", sa.String(length=100), nullable=False), sa.Column("description", sa.Text(), nullable=True))
    op.create_index("ix_roles_name", "roles", ["name"], unique=True)

    op.create_table("permissions", *_soft_delete_columns(), sa.Column("code", sa.String(length=150), nullable=False), sa.Column("description", sa.Text(), nullable=True))
    op.create_index("ix_permissions_code", "permissions", ["code"], unique=True)

    op.create_table(
        "role_permissions",
        *_soft_delete_columns(),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("permissions.id"), nullable=False),
        sa.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )

    op.create_table(
        "staff_users",
        *_soft_delete_columns(),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("roles.id"), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_staff_users_email", "staff_users", ["email"], unique=True)

    op.create_table(
        "audit_logs",
        *_soft_delete_columns(),
        sa.Column("staff_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_users.id"), nullable=True),
        sa.Column("action", sa.String(length=150), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=True),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("impersonated_by_staff_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_users.id"), nullable=True),
    )

    op.create_table(
        "staff_sessions",
        *_soft_delete_columns(),
        sa.Column("staff_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_users.id"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=False),
        sa.Column("device_info", sa.String(length=255), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_staff_sessions_staff_user_id", "staff_sessions", ["staff_user_id"])
    op.create_index("ix_staff_sessions_refresh_token_hash", "staff_sessions", ["refresh_token_hash"], unique=True)


def downgrade() -> None:
    op.drop_table("staff_sessions")
    op.drop_table("audit_logs")
    op.drop_table("staff_users")
    op.drop_table("role_permissions")
    op.drop_table("permissions")
    op.drop_table("roles")
    op.drop_table("departments")