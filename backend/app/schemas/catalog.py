from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, model_validator


class SupplierBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=180)
    contact_person: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: str = Field(..., min_length=5, max_length=40)
    address: Optional[str] = None
    avg_lead_time_days: float = Field(default=5.0, ge=0.5, le=180)
    reliability_status: str = Field(default="Reliable", max_length=40)


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=180)
    contact_person: Optional[str] = Field(default=None, min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, min_length=5, max_length=40)
    address: Optional[str] = None
    avg_lead_time_days: Optional[float] = Field(default=None, ge=0.5, le=180)
    reliability_status: Optional[str] = Field(default=None, max_length=40)


class SupplierOut(SupplierBase):
    id: int
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SupplierDeliveryCreate(BaseModel):
    supplier_id: int
    po_reference: str = Field(..., min_length=2, max_length=64)
    expected_delivery_date: date
    actual_delivery_date: Optional[date] = None


class SupplierDeliveryOut(BaseModel):
    id: int
    supplier_id: int
    po_reference: str
    expected_delivery_date: date
    actual_delivery_date: Optional[date]
    delay_days: int
    delivery_status: str
    is_demo: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sku: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    selling_price: float = Field(..., gt=0)
    cost_price: float = Field(..., gt=0)
    current_stock: int = Field(default=0, ge=0)
    minimum_stock: int = Field(default=10, ge=0)
    reorder_level: int = Field(default=20, ge=0)
    supplier_id: Optional[int] = None

    @model_validator(mode="after")
    def validate_pricing(self):
        if self.selling_price < self.cost_price:
            raise ValueError("Selling price must be greater than or equal to cost price")
        return self


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    sku: Optional[str] = Field(default=None, min_length=1, max_length=64)
    category: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    selling_price: Optional[float] = Field(default=None, gt=0)
    cost_price: Optional[float] = Field(default=None, gt=0)
    current_stock: Optional[int] = Field(default=None, ge=0)
    minimum_stock: Optional[int] = Field(default=None, ge=0)
    reorder_level: Optional[int] = Field(default=None, ge=0)
    supplier_id: Optional[int] = None


class ProductOut(BaseModel):
    id: int
    name: str
    sku: str
    category: str
    description: Optional[str]
    selling_price: float
    cost_price: float
    current_stock: int
    minimum_stock: int
    reorder_level: int
    supplier_id: Optional[int]
    supplier_name: Optional[str] = None
    stock_status: str = "IN_STOCK"
    is_demo: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
