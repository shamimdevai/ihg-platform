"""Business logic for hotel invoices — generation, issuing, payment (via
payments.services.payment_service), and PDF rendering (via
shared_kernel.services.pdf_service). Never touches payments.models/repositories
directly, per the cross-domain service-only rule.
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.company_config import get_company_config
from app.core.exceptions import ConflictError, NotFoundError
from app.domains.hotel.models.invoice import Invoice
from app.domains.hotel.repositories import invoice_repository
from app.domains.hotel.services import booking_service
from app.shared_kernel.services import pdf_service


def _generate_invoice_number(booking_id: UUID) -> str:
    """Simple, human-readable, collision-resistant invoice number. No sequential
    counter table exists yet — revisit if strict sequential numbering is required
    for accounting/compliance later.
    """
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"INV-{stamp}-{str(booking_id)[:8].upper()}"


async def generate_invoice_for_booking(db: AsyncSession, booking_id: UUID) -> Invoice:
    """Create a draft invoice for a checked-out booking, with a single room-charge
    line item (nights x rate_per_night).

    NOTE: service_request charges are not itemized here — ServiceRequest has no
    price field in this phase's schema (the proposal doesn't specify per-request
    pricing). Invoices currently cover the room charge only; revisit once
    service-request pricing is defined.

    Raises:
        ConflictError: booking is not "checked_out", or an invoice already exists
            for this booking.
    """
    booking = await booking_service.get_booking(db, booking_id)
    if booking.status != "checked_out":
        raise ConflictError("An invoice can only be generated for a checked-out booking.")
    if await invoice_repository.get_by_booking_id(db, booking_id) is not None:
        raise ConflictError("An invoice already exists for this booking.")

    nights = max((booking.check_out_date - booking.check_in_date).days, 1)
    room_total = float(booking.rate_per_night) * nights
    currency = get_company_config().currency

    invoice = await invoice_repository.create(
        db,
        booking_id=booking.id,
        invoice_number=_generate_invoice_number(booking.id),
        status="draft",
        subtotal=room_total,
        tax_amount=0,  # TODO: wire to a configurable tax rate once system_settings exposes one
        total_amount=room_total,
        currency=currency,
    )
    await invoice_repository.add_item(
        db,
        invoice_id=invoice.id,
        description=f"Room charge ({nights} night{'s' if nights != 1 else ''} @ {booking.rate_per_night}/night)",
        item_type="room_charge",
        quantity=nights,
        unit_price=booking.rate_per_night,
        line_total=room_total,
    )
    return invoice


async def get_invoice(db: AsyncSession, invoice_id: UUID) -> Invoice:
    invoice = await invoice_repository.get_by_id(db, invoice_id)
    if invoice is None:
        raise NotFoundError("Invoice not found.")
    return invoice


async def get_invoice_items(db: AsyncSession, invoice_id: UUID):
    await get_invoice(db, invoice_id)
    return await invoice_repository.list_items(db, invoice_id)


async def list_invoices(db: AsyncSession, *, status: Optional[str] = None) -> List[Invoice]:
    return await invoice_repository.list_all(db, status=status)


async def issue_invoice(db: AsyncSession, invoice_id: UUID) -> Invoice:
    invoice = await get_invoice(db, invoice_id)
    if invoice.status != "draft":
        raise ConflictError(f"Cannot issue an invoice in '{invoice.status}' status; must be 'draft'.")
    invoice.status = "issued"
    invoice.issued_at = datetime.now(timezone.utc)
    return await invoice_repository.save(db, invoice)


async def pay_invoice(db: AsyncSession, invoice_id: UUID, *, method_id: Optional[UUID] = None) -> Invoice:
    """Pay an issued invoice via the payments domain (demo/test-mode gateway):
    creates a payment intent then confirms it immediately as "paid" — a staff-
    initiated "mark paid" action, distinct from the payments webhook path.

    Raises:
        ConflictError: invoice is not currently "issued".
    """
    from app.domains.payments.services import payment_service  # cross-domain service-only import

    invoice = await get_invoice(db, invoice_id)
    if invoice.status != "issued":
        raise ConflictError(f"Cannot pay an invoice in '{invoice.status}' status; must be 'issued'.")

    payment = await payment_service.create_payment_intent(
        db,
        reference_type="hotel_invoice",
        reference_id=invoice.id,
        amount=invoice.total_amount,
        currency=invoice.currency,
        method_id=method_id,
    )
    payment = await payment_service.confirm_payment(db, payment.id, simulate_outcome="paid")

    invoice.payment_id = payment.id
    invoice.status = "paid"
    return await invoice_repository.save(db, invoice)


async def get_invoice_pdf_bytes(db: AsyncSession, invoice_id: UUID) -> bytes:
    """Render the invoice as branded PDF bytes via shared_kernel.pdf_service.

    ASSUMPTION FLAGGED: assumes app/templates/pdf/invoice_template.html (already
    present per PROJECT_STATE.md's file tree, "not yet triggered — hotel not
    built") accepts `invoice` and `items` context variables in roughly this shape.
    I have not seen the real template. If its variable names differ, send it and
    I'll adjust this context dict (not the template).
    """
    invoice = await get_invoice(db, invoice_id)
    items = await invoice_repository.list_items(db, invoice_id)
    return pdf_service.render_pdf_template(
        "invoice_template.html",
        {
            "invoice": invoice,
            "items": items,
        },
    )