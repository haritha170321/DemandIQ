from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.inventory import InventoryMovement
from app.models.product import Product
from app.models.user import User
from app.schemas.operations import InventoryMovementCreate, InventoryMovementOut
from app.services.operations_service import record_inventory_movement

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


@router.get("")
def get_inventory_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    products = db.query(Product).filter(Product.user_id == current_user.id).order_by(Product.name.asc()).all()
    total_valuation = round(sum(float(p.cost_price) * p.current_stock for p in products), 2)
    retail_valuation = round(sum(float(p.selling_price) * p.current_stock for p in products), 2)

    items = []
    for p in products:
        status_label = "OUT_OF_STOCK" if p.current_stock == 0 else ("LOW_STOCK" if p.current_stock <= p.minimum_stock else "IN_STOCK")
        items.append(
            {
                "product_id": p.id,
                "name": p.name,
                "sku": p.sku,
                "category": p.category,
                "current_stock": p.current_stock,
                "minimum_stock": p.minimum_stock,
                "reorder_level": p.reorder_level,
                "cost_price": float(p.cost_price),
                "selling_price": float(p.selling_price),
                "inventory_value": round(float(p.cost_price) * p.current_stock, 2),
                "stock_status": status_label,
                "updated_at": p.updated_at,
            }
        )

    return {
        "summary": {
            "total_skus": len(products),
            "total_units": sum(p.current_stock for p in products),
            "total_cost_valuation": total_valuation,
            "total_retail_valuation": retail_valuation,
            "low_stock_count": sum(1 for p in products if 0 < p.current_stock <= p.minimum_stock),
            "out_of_stock_count": sum(1 for p in products if p.current_stock == 0),
        },
        "items": items,
    }


@router.post("/movements", response_model=InventoryMovementOut, status_code=status.HTTP_201_CREATED)
def create_movement(
    payload: InventoryMovementCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mv = record_inventory_movement(db, current_user.id, payload)
    return InventoryMovementOut(
        id=mv.id,
        product_id=mv.product_id,
        product_name=mv.product.name,
        sku=mv.product.sku,
        movement_type=mv.movement_type,
        quantity=mv.quantity,
        previous_quantity=mv.previous_quantity,
        new_quantity=mv.new_quantity,
        reason=mv.reason,
        is_demo=mv.is_demo,
        created_at=mv.created_at,
    )


@router.get("/movements")
def list_movements(
    product_id: Optional[int] = Query(default=None),
    movement_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(InventoryMovement).filter(InventoryMovement.user_id == current_user.id)
    if product_id is not None:
        query = query.filter(InventoryMovement.product_id == product_id)
    if movement_type and movement_type != "ALL":
        query = query.filter(InventoryMovement.movement_type == movement_type)

    rows = query.order_by(InventoryMovement.created_at.desc()).limit(limit).all()
    return {
        "items": [
            InventoryMovementOut(
                id=m.id,
                product_id=m.product_id,
                product_name=m.product.name if m.product else "",
                sku=m.product.sku if m.product else "",
                movement_type=m.movement_type,
                quantity=m.quantity,
                previous_quantity=m.previous_quantity,
                new_quantity=m.new_quantity,
                reason=m.reason,
                is_demo=m.is_demo,
                created_at=m.created_at,
            )
            for m in rows
        ]
    }
