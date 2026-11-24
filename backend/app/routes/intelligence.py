from dataclasses import asdict
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.ml.forecaster import generate_product_forecast
from app.models.intelligence import (
    Alert,
    DemandForecast,
    DiscountRecommendation,
    InventoryRisk,
    ReorderRecommendation,
)
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.operations import (
    DiscountGenerateRequest,
    ForecastGenerateRequest,
    RecommendationActionRequest,
    ReorderGenerateRequest,
)
from app.services.analytics_service import (
    get_dashboard_summary,
    get_inventory_analytics,
    get_sales_analytics,
)
from app.services.decision_service import _optional_gemini_narrative, build_decision_insights
from app.services.recommendation_service import (
    generate_budget_reorder_recommendations,
    generate_discount_recommendations,
)
from app.services.risk_service import recalculate_all_risks, recalculate_product_risk

router = APIRouter(tags=["Intelligence & Analytics"])


def _fetch_product_daily_sales(db: Session, user_id: int, product_id: int):
    rows = (
        db.query(Sale.sale_date, SaleItem.quantity)
        .join(SaleItem, SaleItem.sale_id == Sale.id)
        .filter(Sale.user_id == user_id, SaleItem.product_id == product_id)
        .order_by(Sale.sale_date.asc())
        .all()
    )
    return [(dt.date(), int(qty)) for dt, qty in rows]


@router.get("/api/forecast/{product_id}")
def get_forecast(
    product_id: int,
    horizon_days: int = Query(default=30, ge=7, le=90),
    model_preference: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if horizon_days not in (7, 30, 90):
        raise HTTPException(status_code=400, detail="horizon_days must be 7, 30, or 90")
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    daily_sales = _fetch_product_daily_sales(db, current_user.id, product.id)
    result = generate_product_forecast(
        product.id,
        product.name,
        daily_sales,
        horizon_days=horizon_days,
        model_preference=model_preference,
    )
    return {
        **asdict(result),
        "product_name": product.name,
        "sku": product.sku,
        "current_stock": product.current_stock,
    }


@router.post("/api/forecast/generate")
def generate_forecasts(
    payload: ForecastGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.product_id is not None:
        products = db.query(Product).filter(Product.id == payload.product_id, Product.user_id == current_user.id).all()
        if not products:
            raise HTTPException(status_code=404, detail="Product not found")
    else:
        products = db.query(Product).filter(Product.user_id == current_user.id).all()

    outputs = []
    for p in products:
        daily_sales = _fetch_product_daily_sales(db, current_user.id, p.id)
        res = generate_product_forecast(
            p.id,
            p.name,
            daily_sales,
            horizon_days=payload.horizon_days,
            model_preference=payload.model_preference,
        )
        record = DemandForecast(
            user_id=current_user.id,
            product_id=p.id,
            horizon_days=res.horizon_days,
            model_name=res.model_name,
            predicted_total_demand=res.predicted_total_demand,
            predicted_daily_demand=res.predicted_daily_demand,
            trend_direction=res.trend_direction,
            mae=res.mae,
            rmse=res.rmse,
            data_points_used=res.data_points_used,
            sufficient_data=res.sufficient_data,
            explanation=res.explanation,
            forecast_series=res.forecast_series,
        )
        db.add(record)
        outputs.append(
            {
                **asdict(res),
                "product_name": p.name,
                "sku": p.sku,
                "current_stock": p.current_stock,
            }
        )
    db.commit()
    return {"items": outputs}


@router.get("/api/risks")
def list_risks(
    risk_level: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    recalculate_all_risks(db, current_user.id)
    db.commit()
    query = db.query(InventoryRisk).filter(InventoryRisk.user_id == current_user.id)
    if risk_level and risk_level != "ALL":
        query = query.filter(InventoryRisk.risk_level == risk_level)
    risks = query.all()
    products_by_id = {p.id: p for p in db.query(Product).filter(Product.user_id == current_user.id).all()}

    order_map = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    items = []
    for r in risks:
        p = products_by_id.get(r.product_id)
        if not p:
            continue
        items.append(
            {
                "id": r.id,
                "product_id": r.product_id,
                "product_name": p.name,
                "sku": p.sku,
                "category": p.category,
                "available_stock": r.available_stock,
                "avg_daily_demand": r.avg_daily_demand,
                "predicted_daily_demand": r.predicted_daily_demand,
                "days_remaining": r.days_remaining,
                "expected_stockout_date": r.expected_stockout_date,
                "supplier_lead_time_days": r.supplier_lead_time_days,
                "risk_level": r.risk_level,
                "recommended_action": r.recommended_action,
                "calculated_at": r.calculated_at,
            }
        )
    items.sort(key=lambda x: (order_map.get(x["risk_level"], 3), x["days_remaining"] or 999))
    return {"items": items}


@router.get("/api/risks/{product_id}")
def get_product_risk(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    r = recalculate_product_risk(db, current_user.id, product)
    db.commit()
    return {
        "product_id": product.id,
        "product_name": product.name,
        "sku": product.sku,
        "available_stock": r.available_stock,
        "avg_daily_demand": r.avg_daily_demand,
        "predicted_daily_demand": r.predicted_daily_demand,
        "days_remaining": r.days_remaining,
        "expected_stockout_date": r.expected_stockout_date,
        "supplier_lead_time_days": r.supplier_lead_time_days,
        "risk_level": r.risk_level,
        "recommended_action": r.recommended_action,
        "calculated_at": r.calculated_at,
    }


@router.post("/api/recommendations/reorder")
def create_reorder_recommendations(
    payload: ReorderGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return generate_budget_reorder_recommendations(db, current_user.id, payload.budget)


@router.post("/api/recommendations/discount")
def create_discount_recommendations(
    payload: DiscountGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    margin = payload.min_profit_margin_pct if payload.min_profit_margin_pct is not None else current_user.min_profit_margin_pct
    items = generate_discount_recommendations(
        db,
        current_user.id,
        min_profit_margin_pct=margin,
        slow_moving_days_threshold=payload.slow_moving_days_threshold,
    )
    return {"items": items}


@router.get("/api/recommendations")
def list_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    products_by_id = {p.id: p for p in db.query(Product).filter(Product.user_id == current_user.id).all()}
    reorders = (
        db.query(ReorderRecommendation)
        .filter(ReorderRecommendation.user_id == current_user.id)
        .order_by(ReorderRecommendation.created_at.desc(), ReorderRecommendation.priority_rank.asc())
        .all()
    )
    discounts = (
        db.query(DiscountRecommendation)
        .filter(DiscountRecommendation.user_id == current_user.id)
        .order_by(DiscountRecommendation.created_at.desc())
        .all()
    )
    return {
        "reorders": [
            {
                "id": r.id,
                "product_id": r.product_id,
                "product_name": products_by_id[r.product_id].name if r.product_id in products_by_id else "",
                "sku": products_by_id[r.product_id].sku if r.product_id in products_by_id else "",
                "budget_allocated": float(r.budget_allocated),
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
            for r in reorders
        ],
        "discounts": [
            {
                "id": d.id,
                "product_id": d.product_id,
                "product_name": products_by_id[d.product_id].name if d.product_id in products_by_id else "",
                "sku": products_by_id[d.product_id].sku if d.product_id in products_by_id else "",
                "days_since_last_sale": d.days_since_last_sale,
                "stock_age_days": d.stock_age_days,
                "current_stock": d.current_stock,
                "current_selling_price": float(d.current_selling_price),
                "cost_price": float(d.cost_price),
                "recommended_discount_pct": d.recommended_discount_pct,
                "new_selling_price": float(d.new_selling_price),
                "estimated_profit_per_unit": float(d.estimated_profit_per_unit),
                "min_profit_margin_pct": d.min_profit_margin_pct,
                "estimated_stock_clearing_impact": d.estimated_stock_clearing_impact,
                "rationale": d.rationale,
                "status": d.status,
                "created_at": d.created_at,
            }
            for d in discounts
        ],
    }


@router.patch("/api/recommendations/reorder/{rec_id}")
def update_reorder_status(
    rec_id: int,
    payload: RecommendationActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = (
        db.query(ReorderRecommendation)
        .filter(ReorderRecommendation.id == rec_id, ReorderRecommendation.user_id == current_user.id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Reorder recommendation not found")
    rec.status = payload.status
    db.commit()
    return {"id": rec.id, "status": rec.status}


@router.patch("/api/recommendations/discount/{rec_id}")
def update_discount_status(
    rec_id: int,
    payload: RecommendationActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rec = (
        db.query(DiscountRecommendation)
        .filter(DiscountRecommendation.id == rec_id, DiscountRecommendation.user_id == current_user.id)
        .first()
    )
    if not rec:
        raise HTTPException(status_code=404, detail="Discount recommendation not found")
    rec.status = payload.status
    if payload.status == "ACCEPTED":
        product = db.query(Product).filter(Product.id == rec.product_id, Product.user_id == current_user.id).first()
        if product:
            product.selling_price = rec.new_selling_price
    db.commit()
    return {"id": rec.id, "status": rec.status}


@router.get("/api/decisions")
async def get_decisions(
    enhance_with_ai: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    insights = build_decision_insights(db, current_user.id)
    if enhance_with_ai:
        for item in insights[:5]:
            item["ai_narrative"] = await _optional_gemini_narrative(item)
    return {"items": insights}


@router.get("/api/alerts")
def list_alerts(
    severity: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    unread_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Alert).filter(Alert.user_id == current_user.id, Alert.is_resolved.is_(False))
    if severity and severity != "ALL":
        query = query.filter(Alert.severity == severity)
    if category and category != "ALL":
        query = query.filter(Alert.category == category)
    if unread_only:
        query = query.filter(Alert.is_read.is_(False))
    items = query.order_by(Alert.created_at.desc()).all()
    return {
        "items": items,
        "unread_count": db.query(Alert)
        .filter(Alert.user_id == current_user.id, Alert.is_resolved.is_(False), Alert.is_read.is_(False))
        .count(),
    }


@router.patch("/api/alerts/{alert_id}/read")
def mark_alert_read(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    return {"id": alert.id, "is_read": alert.is_read}


@router.patch("/api/alerts/read-all")
def mark_all_alerts_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Alert).filter(Alert.user_id == current_user.id, Alert.is_read.is_(False)).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


@router.get("/api/dashboard/summary")
def dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_dashboard_summary(db, current_user.id)


@router.get("/api/analytics/sales")
def sales_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_sales_analytics(db, current_user.id)


@router.get("/api/analytics/inventory")
def inventory_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_inventory_analytics(db, current_user.id)


@router.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "demandiq-api"}
