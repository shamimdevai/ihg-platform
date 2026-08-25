"""Re-exports hotel domain model classes for app.db.model_registry."""
from app.domains.hotel.models.booking import Booking
from app.domains.hotel.models.hotel import Hotel
from app.domains.hotel.models.housekeeping_task import HousekeepingTask
from app.domains.hotel.models.invoice import Invoice
from app.domains.hotel.models.invoice_item import InvoiceItem
from app.domains.hotel.models.room import Room
from app.domains.hotel.models.room_type import RoomType
from app.domains.hotel.models.service_request import ServiceRequest

__all__ = [
    "Hotel",
    "RoomType",
    "Room",
    "Booking",
    "HousekeepingTask",
    "Invoice",
    "InvoiceItem",
    "ServiceRequest",
]