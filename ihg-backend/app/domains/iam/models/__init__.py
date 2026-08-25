"""Re-exports iam domain model classes for app.db.model_registry."""
from app.domains.iam.models.audit_log import AuditLog
from app.domains.iam.models.department import Department
from app.domains.iam.models.permission import Permission
from app.domains.iam.models.role import Role
from app.domains.iam.models.role_permission import RolePermission
from app.domains.iam.models.staff_session import StaffSession
from app.domains.iam.models.staff_user import StaffUser

__all__ = [
    "AuditLog",
    "Department",
    "Permission",
    "Role",
    "RolePermission",
    "StaffSession",
    "StaffUser",
]