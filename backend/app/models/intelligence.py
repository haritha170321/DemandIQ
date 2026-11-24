from datetime import date, datetime, timezone
from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    horizon_days = Column(Integer, nullable=False, default=30)
    model_name = Column(String(120), nullable=False)
    predicted_total_demand = Column(Float, nullable=False)
    predicted_daily_demand = Column(Float, nullable=False)
    trend_direction = Column(String(32), nullable=False)  # INCREASING, DECREASING, STABLE
    mae = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    data_points_used = Column(Integer, nullable=False, default=0)
    sufficient_data = Column(Boolean, nullable=False, default=True)
    explanation = Column(Text, nullable=False)
    forecast_series = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    product = relationship("Product", back_populates="forecasts")


class InventoryRisk(Base):
    __tablename__ = "inventory_risks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    available_stock = Column(Integer, nullable=False)
    avg_daily_demand = Column(Float, nullable=False)
    predicted_daily_demand = Column(Float, nullable=False)
    days_remaining = Column(Float, nullable=True)
    expected_stockout_date = Column(Date, nullable=True)
    supplier_lead_time_days = Column(Float, nullable=False, default=5.0)
    risk_level = Column(String(16), nullable=False, index=True)  # LOW, MEDIUM, HIGH
    recommended_action = Column(Text, nullable=False)
    calculated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    product = relationship("Product", back_populates="risks")


class ReorderRecommendation(Base):
    __tablename__ = "reorder_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_allocated = Column(Numeric(12, 2), nullable=False)
    priority_rank = Column(Integer, nullable=False)
    priority_score = Column(Float, nullable=False)
    recommended_quantity = Column(Integer, nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=False)
    total_cost = Column(Numeric(12, 2), nullable=False)
    safety_stock_target = Column(Integer, nullable=False)
    rationale = Column(Text, nullable=False)
    status = Column(String(24), nullable=False, default="PENDING")  # PENDING, ACCEPTED, REJECTED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    product = relationship("Product", back_populates="reorder_recommendations")


class DiscountRecommendation(Base):
    __tablename__ = "discount_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    days_since_last_sale = Column(Integer, nullable=False)
    stock_age_days = Column(Integer, nullable=False)
    current_stock = Column(Integer, nullable=False)
    current_selling_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=False)
    recommended_discount_pct = Column(Float, nullable=False)
    new_selling_price = Column(Numeric(12, 2), nullable=False)
    estimated_profit_per_unit = Column(Numeric(12, 2), nullable=False)
    min_profit_margin_pct = Column(Float, nullable=False)
    estimated_stock_clearing_impact = Column(Text, nullable=False)
    rationale = Column(Text, nullable=False)
    status = Column(String(24), nullable=False, default="PENDING")  # PENDING, ACCEPTED, REJECTED
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    product = relationship("Product", back_populates="discount_recommendations")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    severity = Column(String(16), nullable=False, index=True)  # HIGH, MEDIUM, LOW
    message = Column(Text, nullable=False)
    related_product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    related_supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True)
    dedupe_key = Column(String(160), nullable=False, index=True)
    is_read = Column(Boolean, nullable=False, default=False, index=True)
    is_resolved = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    user = relationship("User", back_populates="alerts")
