"""Re-exports restaurant domain model classes for app.db.model_registry."""
from app.domains.restaurant.models.dine_in_order import DineInOrder
from app.domains.restaurant.models.dine_in_order_item import DineInOrderItem
from app.domains.restaurant.models.dining_table import DiningTable
from app.domains.restaurant.models.kitchen_ticket import KitchenTicket
from app.domains.restaurant.models.menu_category import MenuCategory
from app.domains.restaurant.models.menu_item import MenuItem
from app.domains.restaurant.models.restaurant import Restaurant
from app.domains.restaurant.models.table_reservation import TableReservation
from app.domains.restaurant.models.waiter_assignment import WaiterAssignment

__all__ = [
    "Restaurant",
    "DiningTable",
    "TableReservation",
    "MenuCategory",
    "MenuItem",
    "DineInOrder",
    "DineInOrderItem",
    "WaiterAssignment",
    "KitchenTicket",
]