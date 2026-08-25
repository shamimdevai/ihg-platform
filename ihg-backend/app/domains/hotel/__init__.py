"""Hotel domain — rooms, bookings, check-in/out, housekeeping, invoices, and
in-room service requests. Built Phase 7. First real consumer of
inventory.services.inventory_service.adjust_stock() (not wired yet — no room/
minibar stock consumption implemented this phase) and
payments.services.payment_service (wired via invoice_service.pay_invoice()).
"""