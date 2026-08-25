"""Raw database queries for the delivery domain — one module per model, except
delivery_order_repository.py (handles DeliveryOrder + DeliveryOrderItem), per
the task spec — an order item is always accessed in the context of its parent
order, mirroring restaurant.repositories.dine_in_order_repository.py /
hotel.repositories.invoice_repository.py's precedent.
"""