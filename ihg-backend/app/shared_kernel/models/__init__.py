"""Re-exports shared_kernel model classes for app.db.model_registry.

Importing this package (as model_registry.py does) is what makes Base.metadata aware
of these three tables before Alembic autogenerate or app.db.init_db run.
"""
from app.shared_kernel.models.attachment import Attachment
from app.shared_kernel.models.notification import Notification
from app.shared_kernel.models.password_reset_token import PasswordResetToken

__all__ = ["Attachment", "Notification", "PasswordResetToken"]