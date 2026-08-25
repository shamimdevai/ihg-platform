"""Single source of truth for Alembic (and future init_db) table discovery.

Every domain's `models/__init__.py` re-exports its model classes. This file imports
each domain's `models` package so `Base.metadata` is complete before Alembic
autogenerate runs. No domain, service, or API file should ever import this module
directly — it exists solely for Alembic/bootstrap purposes.

Uncomment each line as that domain's models are built (see PROJECT_STATE.md §8 roadmap).
"""
from app.domains.customers import models as customers_models  # noqa: F401
from app.domains.delivery import models as delivery_models  # noqa: F401
from app.domains.hotel import models as hotel_models  # noqa: F401
from app.domains.iam import models as iam_models  # noqa: F401
from app.domains.inventory import models as inventory_models  # noqa: F401
from app.domains.payments import models as payments_models  # noqa: F401
from app.domains.restaurant import models as restaurant_models  # noqa: F401
from app.domains.settings import models as settings_models  # noqa: F401
from app.shared_kernel import models as shared_kernel_models  # noqa: F401

# reporting owns no tables — never registered here.