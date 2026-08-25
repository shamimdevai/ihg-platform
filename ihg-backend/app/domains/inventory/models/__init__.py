"""Re-exports inventory domain model classes for app.db.model_registry."""
from app.domains.inventory.models.inventory_item import InventoryItem
from app.domains.inventory.models.stock import Stock
from app.domains.inventory.models.stock_alert import StockAlert
from app.domains.inventory.models.stock_transaction import StockTransaction
from app.domains.inventory.models.supplier import Supplier

__all__ = ["InventoryItem", "Stock", "StockAlert", "StockTransaction", "Supplier"]