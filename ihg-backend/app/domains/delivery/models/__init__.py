"""Re-exports delivery domain model classes for app.db.model_registry."""
from app.domains.delivery.models.delivery_assignment import DeliveryAssignment
from app.domains.delivery.models.delivery_order import DeliveryOrder
from app.domains.delivery.models.delivery_order_item import DeliveryOrderItem
from app.domains.delivery.models.delivery_rider import DeliveryRider

__all__ = [
    "DeliveryRider",
    "DeliveryOrder",
    "DeliveryOrderItem",
    "DeliveryAssignment",
]