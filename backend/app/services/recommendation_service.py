from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import math
from typing import Any, Dict, List
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.intelligence import (
    DiscountRecommendation,
    InventoryRisk,
    ReorderRecommendation,
)
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.supplier import Supplier
from app.services.risk_service import recalculate_all_risks, resolve_alert_if_exists, upsert_alert

settings = get_settings()


def generate_budget_reorder_recommendations(
    db: Session,
    user_id: int,
    budget: float,
) -> Dict[str, Any]:
    recalculate_all_risks(db, user_id)

    products = db.query(Product).filter(Product.user_id == user_id).all()
    risks_by_pid = {
        r.product_id: r
        for r in db.query(InventoryRisk).filter(InventoryRisk.user_id == user_id).all()
    }
    suppliers_by_id = {
        s.id: s
        for s in db.query(Supplier).filter(Supplier.user_id == user_id).all()
    }

    candidates: List[Dict[str, Any]] = []
    total_ideal_cost = 0.0

    for product in products:
        risk = risks_by_pid.get(product.id)
        avg_daily = float(risk.avg_daily_demand) if risk else 0.0
        lead_time = float(risk.supplier_lead_time_days) if risk else 5.0
        if product.supplier_id and product.supplier_id in suppliers_by_id:
            lead_time = float(suppliers_by_id[product.supplier_id].avg_lead_time_days)

        safety_stock = max(int(product.minimum_stock), int(math.ceil(avg_daily * max(3.0, lead_time * 0.5))))
        target_stock = max(
            int(product.reorder_level) + safety_stock,
            int(math.ceil(avg_daily * (lead_time + 21))) + safety_stock,
        )
        needed_qty = max(0, target_stock - int(product.current_stock))
        if needed_qty <= 0:
            continue

        unit_cost = float(product.cost_price)
        unit_profit = max(0.0, float(product.selling_price) - unit_cost)
        margin_ratio = unit_profit / float(product.selling_price) if float(product.selling_price) > 0 else 0.0

        # Urgency score weights: risk level, days remaining vs lead time, profit contribution
        risk_weight = {"HIGH": 100.0, "MEDIUM": 55.0, "LOW": 20.0}.get(risk.risk_level if risk else "LOW", 20.0)
        days_rem = risk.days_remaining if (risk and risk.days_remaining is not None) else 999.0
        urgency_bonus = max(0.0, 40.0 - min(days_rem, 40.0))
        profit_importance = min(30.0, (avg_daily * unit_profit) / 25.0 + margin_ratio * 20.0)
        priority_score = round(risk_weight + urgency_bonus + profit_importance, 2)

        total_ideal_cost += needed_qty * unit_cost
        candidates.append(
            {
                "product": product,
                "risk": risk,
                "needed_qty": needed_qty,
                "unit_cost": unit_cost,
                "safety_stock": safety_stock,
                "priority_score": priority_score,
                "avg_daily": avg_daily,
                "lead_time": lead_time,
            }
        )

    candidates.sort(key=lambda c: c["priority_score"], reverse=True)

    # Remove previous pending recommendations before storing fresh batch
    db.query(ReorderRecommendation).filter(
        ReorderRecommendation.user_id == user_id,
        ReorderRecommendation.status == "PENDING",
    ).delete()

    remaining_budget = float(budget)
    created_items: List[ReorderRecommendation] = []
    rank = 1

    for c in candidates:
        unit_cost = c["unit_cost"]
        if unit_cost <= 0 or remaining_budget < unit_cost:
            continue

        max_affordable = int(math.floor(remaining_budget / unit_cost))
        recommended_qty = min(c["needed_qty"], max_affordable)
        if recommended_qty <= 0:
            continue

        line_cost = round(recommended_qty * unit_cost, 2)
        remaining_budget = round(remaining_budget - line_cost, 2)
        p: Product = c["product"]
        risk: InventoryRisk | None = c["risk"]

        partial_note = (
            f" (budget-capped from {c['needed_qty']} ideal units)"
            if recommended_qty < c["needed_qty"]
            else ""
        )
        rationale = (
            f"{p.name} is ranked #{rank} ({risk.risk_level if risk else 'MEDIUM'} risk) with {p.current_stock} units on hand, "
            f"avg demand {c['avg_daily']:.1f}/day, and {c['lead_time']:.0f}-day supplier lead time. "
            f"Ordering {recommended_qty} units restores safety stock target ({c['safety_stock']} units){partial_note}."
        )

        rec = ReorderRecommendation(
            user_id=user_id,
            product_id=p.id,
            budget_allocated=Decimal(str(round(budget, 2))),
            priority_rank=rank,
            priority_score=c["priority_score"],
            recommended_quantity=recommended_qty,
            unit_cost=Decimal(str(round(unit_cost, 2))),
            total_cost=Decimal(str(line_cost)),
            safety_stock_target=c["safety_stock"],
            rationale=rationale,
            status="PENDING",
        )
        db.add(rec)
        created_items.append(rec)
        rank += 1

    # Alert if purchasing budget cannot cover urgent high-risk needs
    if total_ideal_cost > budget and any(c["risk"] and c["risk"].risk_level == "HIGH" for c in candidates):
        upsert_alert(
            db,
            user_id,
            category="INSUFFICIENT_BUDGET",
            severity="MEDIUM",
            message=(
                f"Configured purchasing budget ({budget:,.0f}) covers only part of total replenishment need "
                f"({total_ideal_cost:,.0f}). Prioritize top-ranked critical SKUs."
            ),
            dedupe_key="budget:insufficient",
        )
    else:
        resolve_alert_if_exists(db, user_id, "budget:insufficient")

    db.commit()
    for rec in created_items:
        db.refresh(rec)

    spent = round(sum(float(r.total_cost) for r in created_items), 2)
    return {
        "budget": round(budget, 2),
        "total_allocated_cost": spent,
        "remaining_budget": round(budget - spent, 2),
        "budget_utilization_pct": round((spent / budget) * 100.0, 1) if budget > 0 else 0.0,
        "total_ideal_cost": round(total_ideal_cost, 2),
        "recommendations": [
            {
                "id": r.id,
                "product_id": r.product_id,
                "product_name": next((c["product"].name for c in candidates if c["product"].id == r.product_id), ""),
                "sku": next((c["product"].sku for c in candidates if c["product"].id == r.product_id), ""),
                "priority_rank": r.priority_rank,
                "priority_score": r.priority_score,
                "recommended_quantity": r.recommended_quantity,
                "unit_cost": float(r.unit_cost),
                "total_cost": float(r.total_cost),
                "safety_stock_target": r.safety_stock_target,
                "rationale": r.rationale,
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in created_items
        ],
    }


def generate_discount_recommendations(
    db: Session,
    user_id: int,
    min_profit_margin_pct: float | None = None,
    slow_moving_days_threshold: int = 21,
) -> List[Dict[str, Any]]:
    margin_floor = (
        float(min_profit_margin_pct)
        if min_profit_margin_pct is not None
        else float(settings.MIN_PROFIT_MARGIN_PCT)
    )
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    products = db.query(Product).filter(Product.user_id == user_id, Product.current_stock > 0).all()

    db.query(DiscountRecommendation).filter(
        DiscountRecommendation.user_id == user_id,
        DiscountRecommendation.status == "PENDING",
    ).delete()

    created: List[tuple[DiscountRecommendation, Product]] = []

    for product in products:
        last_sale_dt = (
            db.query(func.max(Sale.sale_date))
            .join(SaleItem, SaleItem.sale_id == Sale.id)
            .filter(Sale.user_id == user_id, SaleItem.product_id == product.id)
            .scalar()
        )

        sold_last_30 = (
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

        created_at = product.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        if last_sale_dt:
            if last_sale_dt.tzinfo is None:
                last_sale_dt = last_sale_dt.replace(tzinfo=timezone.utc)
            days_since_last = max(0, (now - last_sale_dt).days)
        else:
            days_since_last = max(0, (now - created_at).days)

        stock_age_days = max(days_since_last, (now - created_at).days)
        avg_daily_30 = float(sold_last_30) / 30.0
        days_of_supply = (product.current_stock / avg_daily_30) if avg_daily_30 > 0 else 999.0

        is_slow_moving = days_since_last >= slow_moving_days_threshold or (
            days_of_supply >= 90.0 and product.current_stock >= max(15, product.reorder_level)
        )
        if not is_slow_moving:
            continue

        selling = float(product.selling_price)
        cost = float(product.cost_price)
        if selling <= cost or selling <= 0:
            continue

        # Minimum selling price preserving configured profit margin:
        # (new_price - cost) / new_price >= margin_floor / 100
        margin_frac = min(0.80, max(0.0, margin_floor / 100.0))
        min_allowed_price = cost / (1.0 - margin_frac) if margin_frac < 1.0 else selling
        if min_allowed_price >= selling:
            # Current margin is already at or below floor; cannot discount safely
            continue

        max_safe_discount_pct = ((selling - min_allowed_price) / selling) * 100.0

        # Determine target discount from stagnation severity, capped by safety ceiling
        if days_since_last >= 45:
            desired_discount_pct = 20.0
        elif days_since_last >= 30:
            desired_discount_pct = 15.0
        else:
            desired_discount_pct = 10.0

        recommended_pct = round(min(desired_discount_pct, max_safe_discount_pct), 1)
        if recommended_pct < 3.0:
            continue

        new_price = round(selling * (1.0 - recommended_pct / 100.0), 2)
        new_price = max(new_price, round(min_allowed_price, 2))
        profit_per_unit = round(new_price - cost, 2)

        est_lift_units = min(product.current_stock, max(5, int(round(product.current_stock * 0.35))))
        clearing_impact = f"Projected to clear ~{est_lift_units} units ({round((est_lift_units / product.current_stock) * 100)}% of stagnant stock) within 30 days"
        rationale = (
            f"{product.name} has had no sales for {days_since_last} days with {product.current_stock} units sitting in stock. "
            f"A {recommended_pct:.1f}% markdown lowers price to {new_price:,.2f} while preserving a "
            f"{((profit_per_unit / new_price) * 100):.1f}% margin (above the {margin_floor:.1f}% floor)."
        )

        rec = DiscountRecommendation(
            user_id=user_id,
            product_id=product.id,
            days_since_last_sale=days_since_last,
            stock_age_days=stock_age_days,
            current_stock=product.current_stock,
            current_selling_price=Decimal(str(round(selling, 2))),
            cost_price=Decimal(str(round(cost, 2))),
            recommended_discount_pct=recommended_pct,
            new_selling_price=Decimal(str(new_price)),
            estimated_profit_per_unit=Decimal(str(profit_per_unit)),
            min_profit_margin_pct=margin_floor,
            estimated_stock_clearing_impact=clearing_impact,
            rationale=rationale,
            status="PENDING",
        )
        db.add(rec)
        created.append((rec, product))

        upsert_alert(
            db,
            user_id,
            category="SLOW_MOVING_PRODUCT",
            severity="MEDIUM",
            message=f"{product.name} is slow-moving ({days_since_last} days since last sale, {product.current_stock} units on hand).",
            dedupe_key=f"slow:{product.id}",
            related_product_id=product.id,
        )

    db.commit()
    output = []
    for rec, product in created:
        db.refresh(rec)
        output.append(
            {
                "id": rec.id,
                "product_id": rec.product_id,
                "product_name": product.name,
                "sku": product.sku,
                "category": product.category,
                "days_since_last_sale": rec.days_since_last_sale,
                "stock_age_days": rec.stock_age_days,
                "current_stock": rec.current_stock,
                "current_selling_price": float(rec.current_selling_price),
                "cost_price": float(rec.cost_price),
                "recommended_discount_pct": rec.recommended_discount_pct,
                "new_selling_price": float(rec.new_selling_price),
                "estimated_profit_per_unit": float(rec.estimated_profit_per_unit),
                "min_profit_margin_pct": rec.min_profit_margin_pct,
                "estimated_stock_clearing_impact": rec.estimated_stock_clearing_impact,
                "rationale": rec.rationale,
                "status": rec.status,
                "created_at": rec.created_at,
            }
        )
    return output
