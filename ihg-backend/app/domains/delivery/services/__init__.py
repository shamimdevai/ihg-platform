"""Delivery domain services — business logic, validation, and cross-domain
orchestration: restaurant.services.menu_service/restaurant_service for order
placement (menu item snapshotting, restaurant existence), inventory.services
.inventory_service.adjust_stock() for order-driven stock consumption,
customers.services.address_service for delivery-address ownership checks, and
iam.services.staff_service for rider staff-account verification. Never
imports another domain's models or repositories directly.
"""