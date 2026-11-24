from __future__ import annotations

from typing import Any, Dict, List
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.purchase_order import SupplierDelivery
from app.models.supplier import Supplier
from app.services.risk_service import resolve_alert_if_exists, upsert_alert


def analyze_supplier_risks(db: Session, user_id: int) -> List[Dict[str, Any]]:
    suppliers = db.query(Supplier).filter(Supplier.user_id == user_id).order_by(Supplier.name.asc()).all()
    results: List[Dict[str, Any]] = []

    for supplier in suppliers:
        deliveries = (
            db.query(SupplierDelivery)
            .filter(SupplierDelivery.user_id == user_id, SupplierDelivery.supplier_id == supplier.id)
            .all()
        )
        completed = [d for d in deliveries if d.actual_delivery_date is not None]
        total_deliveries = len(completed)
        on_time = sum(1 for d in completed if d.delay_days <= 0)
        delayed = sum(1 for d in completed if d.delay_days > 0)
        product_count = db.query(Product).filter(Product.user_id == user_id, Product.supplier_id == supplier.id).count()

        if total_deliveries < 3:
            risk_level = "INSUFFICIENT_DATA"
            delay_pct = round((delayed / total_deliveries) * 100.0, 1) if total_deliveries > 0 else 0.0
            avg_delay = round(sum(max(0, d.delay_days) for d in completed) / total_deliveries, 1) if total_deliveries > 0 else 0.0
            avg_delivery_time = round(float(supplier.avg_lead_time_days) + avg_delay, 1)
            assessment = (
                f"Insufficient historical records ({total_deliveries} completed deliveries). "
                "Log at least 3 deliveries to establish reliable delay risk."
            )
            resolve_alert_if_exists(db, user_id, f"supplier_risk:{supplier.id}")
        else:
            delay_pct = round((delayed / total_deliveries) * 100.0, 1)
            avg_delay = round(sum(max(0, d.delay_days) for d in completed) / total_deliveries, 1)
            avg_delivery_time = round(float(supplier.avg_lead_time_days) + avg_delay, 1)

            if delay_pct >= 40.0 or avg_delay >= 3.0:
                risk_level = "HIGH"
                assessment = (
                    f"{delay_pct:.0f}% of deliveries arrived late (avg delay {avg_delay:.1f} days). "
                    "Increase safety stock or qualify a backup vendor."
                )
                upsert_alert(
                    db,
                    user_id,
                    category="SUPPLIER_DELAY_RISK",
                    severity="HIGH",
                    message=f"Supplier {supplier.name} has a {delay_pct:.0f}% delay rate across {total_deliveries} deliveries.",
                    dedupe_key=f"supplier_risk:{supplier.id}",
                    related_supplier_id=supplier.id,
                )
            elif delay_pct >= 20.0 or avg_delay >= 1.5:
                risk_level = "MEDIUM"
                assessment = f"Moderate delay rate ({delay_pct:.0f}%). Monitor upcoming purchase orders closely."
                resolve_alert_if_exists(db, user_id, f"supplier_risk:{supplier.id}")
            else:
                risk_level = "LOW"
                assessment = f"Consistent on-time performance ({on_time}/{total_deliveries} deliveries on schedule)."
                resolve_alert_if_exists(db, user_id, f"supplier_risk:{supplier.id}")

        results.append(
            {
                "supplier_id": supplier.id,
                "supplier_name": supplier.name,
                "contact_person": supplier.contact_person,
                "email": supplier.email,
                "avg_lead_time_days": float(supplier.avg_lead_time_days),
                "total_deliveries": total_deliveries,
                "on_time_deliveries": on_time,
                "delayed_deliveries": delayed,
                "avg_delivery_time_days": avg_delivery_time,
                "delay_percentage": delay_pct,
                "risk_level": risk_level,
                "insufficient_records": total_deliveries < 3,
                "linked_products": product_count,
                "assessment": assessment,
            }
        )

    db.commit()
    return results
