"""Invoice generation, retrieval, issuing, payment, and branded PDF download."""
from io import BytesIO
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.hotel.schemas.invoice import InvoiceDetailRead, InvoiceItemRead, InvoicePayRequest, InvoiceRead
from app.domains.hotel.services import invoice_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/invoices", tags=["hotel"])


@router.post("/generate/{booking_id}", dependencies=[Depends(require_permission("hotel:invoice:write"))])
async def generate_invoice(booking_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    """Generate a draft invoice for a checked-out booking."""
    invoice = await invoice_service.generate_invoice_for_booking(db, booking_id)
    return envelope(data=InvoiceRead.model_validate(invoice), message="Invoice generated.")


@router.get("", dependencies=[Depends(require_permission("hotel:invoice:read"))])
async def list_invoices(status: Optional[str] = None, db: AsyncSession = Depends(get_db)) -> dict:
    invoices = await invoice_service.list_invoices(db, status=status)
    return envelope(data=[InvoiceRead.model_validate(i) for i in invoices])


@router.get("/{invoice_id}", dependencies=[Depends(require_permission("hotel:invoice:read"))])
async def get_invoice(invoice_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    invoice = await invoice_service.get_invoice(db, invoice_id)
    items = await invoice_service.get_invoice_items(db, invoice_id)
    detail = InvoiceDetailRead.model_validate(invoice)
    detail.items = [InvoiceItemRead.model_validate(i) for i in items]
    return envelope(data=detail)


@router.post("/{invoice_id}/issue", dependencies=[Depends(require_permission("hotel:invoice:write"))])
async def issue_invoice(invoice_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    invoice = await invoice_service.issue_invoice(db, invoice_id)
    return envelope(data=InvoiceRead.model_validate(invoice), message="Invoice issued.")


@router.post("/{invoice_id}/pay", dependencies=[Depends(require_permission("hotel:invoice:write"))])
async def pay_invoice(invoice_id: UUID, payload: InvoicePayRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Pay an issued invoice via the payments domain (demo/test-mode gateway)."""
    invoice = await invoice_service.pay_invoice(db, invoice_id, method_id=payload.method_id)
    return envelope(data=InvoiceRead.model_validate(invoice), message="Invoice paid.")


@router.get("/{invoice_id}/pdf", dependencies=[Depends(require_permission("hotel:invoice:read"))])
async def get_invoice_pdf(invoice_id: UUID, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """Download the invoice as a branded PDF."""
    pdf_bytes = await invoice_service.get_invoice_pdf_bytes(db, invoice_id)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice-{invoice_id}.pdf"},
    )