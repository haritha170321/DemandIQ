from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.sale import Sale, SaleItem
from app.models.user import User
from app.schemas.operations import SaleCreate, SaleItemOut, SaleOut
from app.services.operations_service import create_sale_transaction

router = APIRouter(prefix="/api/sales", tags=["Sales"])


def _serialize_sale(sale: Sale) -> SaleOut:
    return SaleOut(
        id=sale.id,
        reference_number=sale.reference_number,
        subtotal=float(sale.subtotal),
        total_amount=float(sale.total_amount),
        notes=sale.notes,
        sale_date=sale.sale_date,
        is_demo=sale.is_demo,
        items=[
            SaleItemOut(
                id=it.id,
                product_id=it.product_id,
                product_name=it.product.name if it.product else "",
                sku=it.product.sku if it.product else "",
                quantity=it.quantity,
                unit_price=float(it.unit_price),
                line_total=float(it.line_total),
            )
            for it in sale.items
        ],
    )


@router.get("")
def list_sales(
    product_id: Optional[int] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    period: Optional[str] = Query(default=None),  # daily, weekly, monthly
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Sale).filter(Sale.user_id == current_user.id)

    now = datetime.now(timezone.utc)
    if period == "daily":
        query = query.filter(Sale.sale_date >= now - timedelta(days=1))
    elif period == "weekly":
        query = query.filter(Sale.sale_date >= now - timedelta(days=7))
    elif period == "monthly":
        query = query.filter(Sale.sale_date >= now - timedelta(days=30))

    if start_date:
        query = query.filter(Sale.sale_date >= datetime.combine(start_date, time.min, tzinfo=timezone.utc))
    if end_date:
        query = query.filter(Sale.sale_date <= datetime.combine(end_date, time.max, tzinfo=timezone.utc))
    if product_id is not None:
        query = query.join(SaleItem, SaleItem.sale_id == Sale.id).filter(SaleItem.product_id == product_id)

    sales = query.order_by(Sale.sale_date.desc()).limit(limit).all()
    total_revenue = round(sum(float(s.total_amount) for s in sales), 2)
    return {
        "items": [_serialize_sale(s) for s in sales],
        "summary": {
            "count": len(sales),
            "total_revenue": total_revenue,
        },
    }


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sale = create_sale_transaction(db, current_user.id, payload)
    return _serialize_sale(sale)


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(
    sale_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sale = db.query(Sale).filter(Sale.id == sale_id, Sale.user_id == current_user.id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale transaction not found")
    return _serialize_sale(sale)
