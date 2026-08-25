"""Request/response schemas for dining tables."""
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DiningTableCreate(BaseModel):
    restaurant_id: UUID
    table_number: str
    capacity: int = Field(default=2, ge=1)
    is_active: bool = True


class DiningTableStatusUpdate(BaseModel):
    status: str = Field(description='"available" | "reserved" | "occupied" | "cleaning"')


class DiningTableRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    table_number: str
    capacity: int
    status: str
    is_active: bool