"""Raw database queries for the restaurant domain — one module per model, except
menu_repository.py (handles MenuCategory + MenuItem) and
dine_in_order_repository.py (handles DineInOrder + DineInOrderItem), per the
task spec — each pair is always accessed in the context of its parent, mirroring
hotel.repositories.invoice_repository.py's Invoice+InvoiceItem precedent.
"""