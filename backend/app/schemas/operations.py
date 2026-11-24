from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class InventoryMovementCreate(BaseModel):
    product_id: int
    movement_type: Literal["ADDITION", "REDUCTION", "ADJUSTMENT"]
    quantity: int = Field(..., ge=0)
    reason: str = Field(..., min_length=2, max_length=300)


class InventoryMovementOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    movement_type: str
    quantity: int
    previous_quantity: int
    new_quantity: int
    reason: str
    is_demo: bool
    created_at: datetime


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class SaleCreate(BaseModel):
    items: List[SaleItemCreate] = Field(..., min_length=1)
    notes: Optional[str] = None
    sale_date: Optional[datetime] = None


class SaleItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    sku: str
    quantity: int
    unit_price: float
    line_total: float


class SaleOut(BaseModel):
    id: int
    reference_number: str
    subtotal: float
    total_amount: float
    notes: Optional[str]
    sale_date: datetime
    is_demo: bool
    items: List[SaleItemOut]


class ForecastGenerateRequest(BaseModel):
    product_id: Optional[int] = None
    horizon_days: Literal[7, 30, 90] = 30
    model_preference: Optional[str] = None


class ReorderGenerateRequest(BaseModel):
    budget: float = Field(..., gt=0)


class DiscountGenerateRequest(BaseModel):
    min_profit_margin_pct: Optional[float] = Field(default=None, ge=0, le=80)
    slow_moving_days_threshold: int = Field(default=21, ge=7, le=180)


class RecommendationActionRequest(BaseModel):
    status: Literal["ACCEPTED", "REJECTED"]


class DecisionInsightOut(BaseModel):
    id: str
    entity_type: str
    entity_id: int
    entity_name: str
    priority: str
    what_is_happening: str
    why_it_happens: str
    business_impact: str
    recommended_action: str
    ai_narrative: Optional[str] = None
    metrics: Dict[str, Any] = {}


class AlertOut(BaseModel):
    id: int
    category: str
    severity: str
    message: str
    related_product_id: Optional[int]
    related_supplier_id: Optional[int]
    is_read: bool
    is_resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}
