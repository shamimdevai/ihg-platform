"""Request/response schemas for invoices and invoice items."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class InvoiceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    description: str
    item_type: str
    quantity: float
    unit_price: float
    line_total: float


class InvoicePayRequest(BaseModel):
    method_id: Optional[UUID] = None


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_id: UUID
    invoice_number: str
    status: str
    subtotal: float
    tax_amount: float
    total_amount: float
    currency: str
    payment_id: Optional[UUID] = None
    issued_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime


class InvoiceDetailRead(InvoiceRead):
    items: List[InvoiceItemRead] = []