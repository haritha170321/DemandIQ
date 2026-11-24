from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    business_name = Column(String(200), nullable=False, default="DemandIQ Retail Operations")
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="owner")
    currency = Column(String(10), nullable=False, default="INR")
    default_budget = Column(Float, nullable=False, default=50000.0)
    min_profit_margin_pct = Column(Float, nullable=False, default=10.0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    suppliers = relationship("Supplier", back_populates="user", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="user", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")
