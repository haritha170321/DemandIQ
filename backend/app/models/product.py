from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("user_id", "sku", name="uq_products_user_sku"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String(200), nullable=False, index=True)
    sku = Column(String(64), nullable=False, index=True)
    category = Column(String(120), nullable=False, index=True)
    description = Column(Text, nullable=True)

    selling_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=False)

    current_stock = Column(Integer, nullable=False, default=0)
    minimum_stock = Column(Integer, nullable=False, default=10)
    reorder_level = Column(Integer, nullable=False, default=20)

    is_demo = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="products")
    category_rel = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    movements = relationship("InventoryMovement", back_populates="product", cascade="all, delete-orphan")
    sale_items = relationship("SaleItem", back_populates="product", cascade="all, delete-orphan")
    forecasts = relationship("DemandForecast", back_populates="product", cascade="all, delete-orphan")
    risks = relationship("InventoryRisk", back_populates="product", cascade="all, delete-orphan")
    reorder_recommendations = relationship("ReorderRecommendation", back_populates="product", cascade="all, delete-orphan")
    discount_recommendations = relationship("DiscountRecommendation", back_populates="product", cascade="all, delete-orphan")
