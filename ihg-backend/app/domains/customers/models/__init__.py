"""Re-exports customers domain model classes for app.db.model_registry."""
from app.domains.customers.models.customer import Customer
from app.domains.customers.models.customer_address import CustomerAddress
from app.domains.customers.models.customer_favorite import CustomerFavorite
from app.domains.customers.models.customer_session import CustomerSession
from app.domains.customers.models.hotel_guest import HotelGuest

__all__ = ["Customer", "CustomerAddress", "CustomerFavorite", "CustomerSession", "HotelGuest"]