from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.ml.forecaster import generate_product_forecast
from app.models.intelligence import DiscountRecommendation, InventoryRisk, ReorderRecommendation
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.services.risk_service import recalculate_all_risks
from app.services.supplier_service import analyze_supplier_risks

settings = get_settings()


async def _optional_gemini_narrative(insight: Dict[str, Any]) -> Optional[str]:
    if not settings.GEMINI_API_KEY:
        return None
    prompt = (
        "Rewrite this inventory intelligence signal into a concise 2-sentence executive briefing. "
        "Do not invent any numbers not present in the facts.\n"
        f"Entity: {insight['entity_name']}\n"
        f"What: {insight['what_is_happening']}\n"
        f"Why: {insight['why_it_happens']}\n"
        f"Impact: {insight['business_impact']}\n"
        f"Action: {insight['recommended_action']}"
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            if resp.status_code == 200:
                data = resp.json()
                text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text")
                return text.strip() if text else None
    except Exception:
        return None
    return None


def build_decision_insights(db: Session, user_id: int) -> List[Dict[str, Any]]:
    recalculate_all_risks(db, user_id)
    supplier_risks = analyze_supplier_risks(db, user_id)

    products = db.query(Product).filter(Product.user_id == user_id).all()
    products_by_id = {p.id: p for p in products}
    risks = db.query(InventoryRisk).filter(InventoryRisk.user_id == user_id).all()
    discounts = (
        db.query(DiscountRecommendation)
        .filter(DiscountRecommendation.user_id == user_id, DiscountRecommendation.status == "PENDING")
        .all()
    )
    reorders = (
        db.query(ReorderRecommendation)
        .filter(ReorderRecommendation.user_id == user_id, ReorderRecommendation.status == "PENDING")
        .all()
    )
    reorders_by_pid = {r.product_id: r for r in reorders}

    # Pre-fetch 90-day daily sales per product for trend checks
    cutoff = date.today() - timedelta(days=90)
    sales_rows = (
        db.query(SaleItem.product_id, Sale.sale_date, SaleItem.quantity)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.user_id == user_id, Sale.sale_date >= cutoff)
        .all()
    )
    sales_by_pid: Dict[int, List[tuple[date, int]]] = {}
    for pid, sdt, qty in sales_rows:
        sales_by_pid.setdefault(pid, []).append((sdt.date(), int(qty)))

    insights: List[Dict[str, Any]] = []

    # 1. High & Medium stockout risk decisions
    for r in sorted(risks, key=lambda x: (0 if x.risk_level == "HIGH" else 1 if x.risk_level == "MEDIUM" else 2, x.days_remaining or 999)):
        p = products_by_id.get(r.product_id)
        if not p:
            continue
        if r.risk_level not in ("HIGH", "MEDIUM"):
            continue

        fc = generate_product_forecast(p.id, p.name, sales_by_pid.get(p.id, []), horizon_days=30)
        reorder_rec = reorders_by_pid.get(p.id)
        trend_phrase = f"demand is {fc.trend_direction.lower()}" if fc.data_points_used >= 7 else "recent velocity exceeds available buffer"

        what = (
            f"{p.name} requires {'immediate' if r.risk_level == 'HIGH' else 'proactive'} attention: "
            f"only {r.available_stock} units remain ({r.days_remaining if r.days_remaining is not None else 'N/A'} days of stock)."
        )
        why = (
            f"Recent {trend_phrase} ({r.avg_daily_demand:.1f} units/day) while supplier lead time is {r.supplier_lead_time_days:.0f} days."
        )
        est_lost_rev = round(float(p.selling_price) * max(1.0, r.avg_daily_demand * max(1.0, r.supplier_lead_time_days)), 2)
        impact = f"Risk of stockout by {r.expected_stockout_date or 'near term'}, threatening ~{est_lost_rev:,.0f} in revenue."
        action = (
            f"Approve purchase order for {reorder_rec.recommended_quantity} units (cost {float(reorder_rec.total_cost):,.0f})."
            if reorder_rec
            else r.recommended_action
        )

        insights.append(
            {
                "id": f"risk-{p.id}",
                "entity_type": "PRODUCT",
                "entity_id": p.id,
                "entity_name": p.name,
                "priority": r.risk_level,
                "what_is_happening": what,
                "why_it_happens": why,
                "business_impact": impact,
                "recommended_action": action,
                "ai_narrative": None,
                "metrics": {
                    "current_stock": r.available_stock,
                    "avg_daily_demand": r.avg_daily_demand,
                    "days_remaining": r.days_remaining,
                    "trend": fc.trend_direction,
                },
            }
        )

    # 2. Supplier delay risk decisions
    for sr in supplier_risks:
        if sr["risk_level"] not in ("HIGH", "MEDIUM"):
            continue
        insights.append(
            {
                "id": f"supplier-{sr['supplier_id']}",
                "entity_type": "SUPPLIER",
                "entity_id": sr["supplier_id"],
                "entity_name": sr["supplier_name"],
                "priority": sr["risk_level"],
                "what_is_happening": f"{sr['supplier_name']} is showing a {sr['delay_percentage']:.0f}% late delivery rate across {sr['total_deliveries']} orders.",
                "why_it_happens": f"{sr['delayed_deliveries']} of {sr['total_deliveries']} completed shipments arrived after expected delivery dates, extending effective lead time to {sr['avg_delivery_time_days']:.1f} days.",
                "business_impact": f"Affects {sr['linked_products']} linked SKUs and increases unexpected stockout exposure during replenishment.",
                "recommended_action": "Increase safety stock targets on linked SKUs or shift partial allocation to a secondary vendor.",
                "ai_narrative": None,
                "metrics": {
                    "delay_percentage": sr["delay_percentage"],
                    "avg_delivery_time_days": sr["avg_delivery_time_days"],
                    "linked_products": sr["linked_products"],
                },
            }
        )

    # 3. Slow-moving inventory & discount decisions
    for d in discounts[:8]:
        p = products_by_id.get(d.product_id)
        if not p:
            continue
        tied_capital = round(float(p.cost_price) * d.current_stock, 2)
        insights.append(
            {
                "id": f"discount-{p.id}",
                "entity_type": "PRODUCT",
                "entity_id": p.id,
                "entity_name": p.name,
                "priority": "MEDIUM",
                "what_is_happening": f"{p.name} has stagnant inventory ({d.current_stock} units) with {d.days_since_last_sale} days since last sale.",
                "why_it_happens": "Recent customer demand has stalled below holding capacity, locking up warehouse space and working capital.",
                "business_impact": f"{tied_capital:,.0f} in cost capital is immobilized with rising shelf-age risk.",
                "recommended_action": (
                    f"Apply a {d.recommended_discount_pct:.1f}% discount (new price {float(d.new_selling_price):,.2f}) "
                    f"while maintaining {float(d.estimated_profit_per_unit):,.2f}/unit profit."
                ),
                "ai_narrative": None,
                "metrics": {
                    "days_since_last_sale": d.days_since_last_sale,
                    "recommended_discount_pct": d.recommended_discount_pct,
                    "tied_capital": tied_capital,
                },
            }
        )

    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    insights.sort(key=lambda item: priority_order.get(item["priority"], 3))
    return insights
