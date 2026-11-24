from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.intelligence import Alert, InventoryRisk
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.supplier import Supplier


def upsert_alert(
    db: Session,
    user_id: int,
    category: str,
    severity: str,
    message: str,
    dedupe_key: str,
    related_product_id: Optional[int] = None,
    related_supplier_id: Optional[int] = None,
) -> Alert:
    existing = (
        db.query(Alert)
        .filter(
            Alert.user_id == user_id,
            Alert.dedupe_key == dedupe_key,
            Alert.is_resolved.is_(False),
        )
        .first()
    )
    if existing:
        existing.severity = severity
        existing.message = message
        return existing

    alert = Alert(
        user_id=user_id,
        category=category,
        severity=severity,
        message=message,
        related_product_id=related_product_id,
        related_supplier_id=related_supplier_id,
        dedupe_key=dedupe_key,
        is_read=False,
        is_resolved=False,
    )
    db.add(alert)
    return alert


def resolve_alert_if_exists(db: Session, user_id: int, dedupe_key: str) -> None:
    db.query(Alert).filter(
        Alert.user_id == user_id,
        Alert.dedupe_key == dedupe_key,
        Alert.is_resolved.is_(False),
    ).update({"is_resolved": True})


def recalculate_product_risk(db: Session, user_id: int, product: Product) -> InventoryRisk:
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    total_30d = (
        db.query(func.coalesce(func.sum(SaleItem.quantity), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(
            Sale.user_id == user_id,
            SaleItem.product_id == product.id,
            Sale.sale_date >= thirty_days_ago,
        )
        .scalar()
        or 0
    )

    avg_daily_demand = round(float(total_30d) / 30.0, 2)
    predicted_daily_demand = avg_daily_demand

    lead_time = 5.0
    if product.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == product.supplier_id, Supplier.user_id == user_id).first()
        if supplier:
            lead_time = float(supplier.avg_lead_time_days)

    available = int(product.current_stock)
    if avg_daily_demand > 0.01:
        days_remaining = round(available / avg_daily_demand, 1)
        expected_stockout_date = date.today() + timedelta(days=max(0, int(round(days_remaining))))
    else:
        days_remaining = None
        expected_stockout_date = None

    # Transparent business rules for stockout risk
    if available == 0 or (days_remaining is not None and days_remaining <= lead_time + 2) or available <= product.minimum_stock:
        risk_level = "HIGH"
        if available == 0:
            recommended_action = f"Out of stock. Place an immediate replenishment order with lead time {lead_time:.0f} days."
        elif days_remaining is not None and days_remaining <= lead_time:
            recommended_action = (
                f"Urgent reorder needed: {days_remaining:.1f} days of cover is below {lead_time:.0f}-day supplier lead time."
            )
        else:
            recommended_action = f"Stock ({available}) is at or below minimum threshold ({product.minimum_stock}). Initiate reorder."
    elif (days_remaining is not None and days_remaining <= lead_time + 10) or available <= product.reorder_level:
        risk_level = "MEDIUM"
        recommended_action = (
            f"Approaching reorder level ({product.reorder_level} units). Schedule purchase order before {expected_stockout_date}."
        )
    else:
        risk_level = "LOW"
        recommended_action = "Inventory coverage is healthy relative to daily demand and supplier lead time."

    existing_risk = (
        db.query(InventoryRisk)
        .filter(InventoryRisk.user_id == user_id, InventoryRisk.product_id == product.id)
        .first()
    )
    if existing_risk:
        existing_risk.available_stock = available
        existing_risk.avg_daily_demand = avg_daily_demand
        existing_risk.predicted_daily_demand = predicted_daily_demand
        existing_risk.days_remaining = days_remaining
        existing_risk.expected_stockout_date = expected_stockout_date
        existing_risk.supplier_lead_time_days = lead_time
        existing_risk.risk_level = risk_level
        existing_risk.recommended_action = recommended_action
        existing_risk.calculated_at = now
        risk_obj = existing_risk
    else:
        risk_obj = InventoryRisk(
            user_id=user_id,
            product_id=product.id,
            available_stock=available,
            avg_daily_demand=avg_daily_demand,
            predicted_daily_demand=predicted_daily_demand,
            days_remaining=days_remaining,
            expected_stockout_date=expected_stockout_date,
            supplier_lead_time_days=lead_time,
            risk_level=risk_level,
            recommended_action=recommended_action,
            calculated_at=now,
        )
        db.add(risk_obj)

    # Deduplicated alerts synchronization
    if available == 0:
        upsert_alert(
            db,
            user_id,
            category="OUT_OF_STOCK",
            severity="HIGH",
            message=f"{product.name} ({product.sku}) is out of stock.",
            dedupe_key=f"oos:{product.id}",
            related_product_id=product.id,
        )
        resolve_alert_if_exists(db, user_id, f"low_stock:{product.id}")
    elif available <= product.minimum_stock:
        resolve_alert_if_exists(db, user_id, f"oos:{product.id}")
        upsert_alert(
            db,
            user_id,
            category="LOW_INVENTORY",
            severity="HIGH",
            message=f"{product.name} is at {available} units (minimum stock: {product.minimum_stock}).",
            dedupe_key=f"low_stock:{product.id}",
            related_product_id=product.id,
        )
    else:
        resolve_alert_if_exists(db, user_id, f"oos:{product.id}")
        resolve_alert_if_exists(db, user_id, f"low_stock:{product.id}")

    if risk_level == "HIGH" and days_remaining is not None and available > 0:
        upsert_alert(
            db,
            user_id,
            category="EXPECTED_STOCKOUT",
            severity="HIGH",
            message=(
                f"{product.name} projected to stock out in {days_remaining:.1f} days "
                f"({expected_stockout_date}), inside {lead_time:.0f}-day supplier lead time."
            ),
            dedupe_key=f"stockout_risk:{product.id}",
            related_product_id=product.id,
        )
    else:
        resolve_alert_if_exists(db, user_id, f"stockout_risk:{product.id}")

    return risk_obj


def recalculate_all_risks(db: Session, user_id: int) -> List[InventoryRisk]:
    products = db.query(Product).filter(Product.user_id == user_id).all()
    results = [recalculate_product_risk(db, user_id, p) for p in products]
    db.flush()
    return results
