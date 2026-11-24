from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=150)
    business_name: str = Field(default="DemandIQ Retail Operations", min_length=2, max_length=200)
    password: str = Field(..., min_length=6, max_length=128)
    currency: str = Field(default="INR", max_length=10)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    business_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    currency: Optional[str] = Field(default=None, max_length=10)
    default_budget: Optional[float] = Field(default=None, gt=0)
    min_profit_margin_pct: Optional[float] = Field(default=None, ge=0, le=80)


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    business_name: str
    role: str
    currency: str
    default_budget: float
    min_profit_margin_pct: float
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
