from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.ml.forecaster import generate_product_forecast
from app.models.intelligence import Alert, DiscountRecommendation, InventoryRisk, ReorderRecommendation
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.services.risk_service import recalculate_all_risks
from app.services.supplier_service import analyze_supplier_risks


def get_dashboard_summary(db: Session, user_id: int) -> Dict[str, Any]:
    recalculate_all_risks(db, user_id)
    supplier_risks = analyze_supplier_risks(db, user_id)

    products = db.query(Product).filter(Product.user_id == user_id).all()
    total_products = len(products)
    total_inventory_value = round(sum(float(p.cost_price) * p.current_stock for p in products), 2)
    low_stock_products = sum(1 for p in products if p.current_stock <= p.minimum_stock)

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    total_sales_count = db.query(Sale).filter(Sale.user_id == user_id).count()
    total_revenue = float(
        db.query(func.coalesce(func.sum(Sale.total_amount), 0)).filter(Sale.user_id == user_id).scalar() or 0
    )
    monthly_revenue = float(
        db.query(func.coalesce(func.sum(Sale.total_amount), 0))
        .filter(Sale.user_id == user_id, Sale.sale_date >= thirty_days_ago)
        .scalar()
        or 0
    )

    risks = db.query(InventoryRisk).filter(InventoryRisk.user_id == user_id).all()
    high_risk_products = sum(1 for r in risks if r.risk_level == "HIGH")
    pending_reorders = (
        db.query(ReorderRecommendation)
        .filter(ReorderRecommendation.user_id == user_id, ReorderRecommendation.status == "PENDING")
        .count()
    )
    supplier_risk_count = sum(1 for s in supplier_risks if s["risk_level"] in ("HIGH", "MEDIUM"))

    recent_sales = (
        db.query(Sale)
        .filter(Sale.user_id == user_id)
        .order_by(Sale.sale_date.desc())
        .limit(6)
        .all()
    )
    critical_alerts = (
        db.query(Alert)
        .filter(Alert.user_id == user_id, Alert.is_resolved.is_(False))
        .order_by(Alert.created_at.desc())
        .limit(6)
        .all()
    )
    top_reorders = (
        db.query(ReorderRecommendation)
        .filter(ReorderRecommendation.user_id == user_id, ReorderRecommendation.status == "PENDING")
        .order_by(ReorderRecommendation.priority_rank.asc())
        .limit(5)
        .all()
    )
    products_by_id = {p.id: p for p in products}

    return {
        "kpis": {
            "total_products": total_products,
            "total_inventory_value": total_inventory_value,
            "total_sales": total_sales_count,
            "total_revenue": round(total_revenue, 2),
            "monthly_revenue": round(monthly_revenue, 2),
            "low_stock_products": low_stock_products,
            "high_risk_products": high_risk_products,
            "pending_reorders": pending_reorders,
            "supplier_risk_count": supplier_risk_count,
        },
        "recent_transactions": [
            {
                "id": s.id,
                "reference_number": s.reference_number,
                "total_amount": float(s.total_amount),
                "sale_date": s.sale_date,
                "item_count": len(s.items),
            }
            for s in recent_sales
        ],
        "critical_alerts": [
            {
                "id": a.id,
                "category": a.category,
                "severity": a.severity,
                "message": a.message,
                "is_read": a.is_read,
                "created_at": a.created_at,
            }
            for a in critical_alerts
        ],
        "top_recommendations": [
            {
                "id": r.id,
                "product_id": r.product_id,
                "product_name": products_by_id[r.product_id].name if r.product_id in products_by_id else "",
                "recommended_quantity": r.recommended_quantity,
                "total_cost": float(r.total_cost),
                "priority_rank": r.priority_rank,
                "rationale": r.rationale,
            }
            for r in top_reorders
        ],
        "inventory_summary": {
            "in_stock": sum(1 for p in products if p.current_stock > p.minimum_stock),
            "low_stock": sum(1 for p in products if 0 < p.current_stock <= p.minimum_stock),
            "out_of_stock": sum(1 for p in products if p.current_stock == 0),
        },
    }


def get_sales_analytics(db: Session, user_id: int) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    six_months_ago = now - timedelta(days=180)
    thirty_days_ago = now - timedelta(days=30)

    sales = (
        db.query(Sale)
        .filter(Sale.user_id == user_id, Sale.sale_date >= six_months_ago)
        .order_by(Sale.sale_date.asc())
        .all()
    )

    daily_map: Dict[str, Dict[str, Any]] = {}
    monthly_map: Dict[str, Dict[str, Any]] = {}

    for s in sales:
        dt = s.sale_date
        day_key = dt.date().isoformat()
        month_key = dt.strftime("%Y-%m")
        if dt >= thirty_days_ago:
            bucket = daily_map.setdefault(day_key, {"date": day_key, "revenue": 0.0, "units": 0})
            bucket["revenue"] = round(bucket["revenue"] + float(s.total_amount), 2)
            bucket["units"] += sum(item.quantity for item in s.items)

        m_bucket = monthly_map.setdefault(month_key, {"month": month_key, "revenue": 0.0, "orders": 0})
        m_bucket["revenue"] = round(m_bucket["revenue"] + float(s.total_amount), 2)
        m_bucket["orders"] += 1

    # Top-selling & slow-moving products
    products = db.query(Product).filter(Product.user_id == user_id).all()
    product_stats: List[Dict[str, Any]] = []
    for p in products:
        rows = (
            db.query(SaleItem.quantity, SaleItem.line_total, Sale.sale_date)
            .join(Sale, Sale.id == SaleItem.sale_id)
            .filter(Sale.user_id == user_id, SaleItem.product_id == p.id)
            .all()
        )
        units_30d = sum(q for q, _, dt in rows if dt.replace(tzinfo=timezone.utc) >= thirty_days_ago)
        rev_30d = sum(float(lt) for _, lt, dt in rows if dt.replace(tzinfo=timezone.utc) >= thirty_days_ago)
        last_dt = max((dt for _, _, dt in rows), default=None)
        days_since = (now - last_dt.replace(tzinfo=timezone.utc)).days if last_dt else 999
        product_stats.append(
            {
                "product_id": p.id,
                "name": p.name,
                "sku": p.sku,
                "category": p.category,
                "units_30d": int(units_30d),
                "revenue_30d": round(rev_30d, 2),
                "current_stock": p.current_stock,
                "days_since_last_sale": days_since,
            }
        )

    top_selling = sorted(product_stats, key=lambda x: x["units_30d"], reverse=True)[:8]
    slow_moving = sorted(product_stats, key=lambda x: (x["units_30d"], -x["days_since_last_sale"]))[:8]

    # Aggregate actual vs predicted demand across top active product for dashboard chart
    actual_vs_predicted: List[Dict[str, Any]] = []
    if top_selling:
        lead_pid = top_selling[0]["product_id"]
        lead_prod = next((p for p in products if p.id == lead_pid), None)
        if lead_prod:
            lead_rows = (
                db.query(Sale.sale_date, SaleItem.quantity)
                .join(SaleItem, SaleItem.sale_id == Sale.id)
                .filter(Sale.user_id == user_id, SaleItem.product_id == lead_pid)
                .all()
            )
            fc = generate_product_forecast(
                lead_pid,
                lead_prod.name,
                [(dt.date(), int(q)) for dt, q in lead_rows],
                horizon_days=14,
            )
            for v in fc.validation_series:
                actual_vs_predicted.append(v)

    return {
        "daily_sales_trend": [daily_map[k] for k in sorted(daily_map.keys())],
        "monthly_revenue": [monthly_map[k] for k in sorted(monthly_map.keys())],
        "top_selling_products": top_selling,
        "slow_moving_products": slow_moving,
        "actual_vs_predicted": actual_vs_predicted,
    }


def get_inventory_analytics(db: Session, user_id: int) -> Dict[str, Any]:
    recalculate_all_risks(db, user_id)
    supplier_risks = analyze_supplier_risks(db, user_id)

    products = db.query(Product).filter(Product.user_id == user_id).all()
    risks = db.query(InventoryRisk).filter(InventoryRisk.user_id == user_id).all()

    by_category: Dict[str, Dict[str, Any]] = {}
    for p in products:
        bucket = by_category.setdefault(p.category, {"category": p.category, "units": 0, "value": 0.0, "sku_count": 0})
        bucket["units"] += p.current_stock
        bucket["value"] = round(bucket["value"] + float(p.cost_price) * p.current_stock, 2)
        bucket["sku_count"] += 1

    risk_dist = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for r in risks:
        if r.risk_level in risk_dist:
            risk_dist[r.risk_level] += 1

    return {
        "inventory_by_category": list(by_category.values()),
        "stockout_risk_distribution": [
            {"risk_level": k, "count": v} for k, v in risk_dist.items()
        ],
        "supplier_performance": [
            {
                "supplier_name": s["supplier_name"],
                "on_time_deliveries": s["on_time_deliveries"],
                "delayed_deliveries": s["delayed_deliveries"],
                "delay_percentage": s["delay_percentage"],
                "risk_level": s["risk_level"],
            }
            for s in supplier_risks
        ],
    }
