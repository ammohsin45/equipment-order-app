from pydantic import BaseModel
from typing import Optional
from datetime import date


class OrderCreate(BaseModel):
    Equipment: str
    Order: str
    Vendor: Optional[str] = None
    DeliveryDate: Optional[date] = None
    Status: Optional[str] = None
    Notes: Optional[str] = None


class OrderUpdate(BaseModel):
    Order: Optional[str] = None
    Vendor: Optional[str] = None
    DeliveryDate: Optional[date] = None
    Status: Optional[str] = None
    Notes: Optional[str] = None