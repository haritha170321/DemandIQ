from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import uuid
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory import InventoryMovement
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.schemas.operations import InventoryMovementCreate, SaleCreate
from app.services.risk_service import recalculate_product_risk


def record_inventory_movement(db: Session, user_id: int, payload: InventoryMovementCreate) -> InventoryMovement:
    product = (
        db.query(Product)
        .filter(Product.id == payload.product_id, Product.user_id == user_id)
        .with_for_update()
        .first()
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    prev_qty = int(product.current_stock)
    if payload.movement_type == "ADDITION":
        if payload.quantity <= 0:
            raise HTTPException(status_code=400, detail="Addition quantity must be greater than zero")
        new_qty = prev_qty + payload.quantity
    elif payload.movement_type == "REDUCTION":
        if payload.quantity <= 0:
            raise HTTPException(status_code=400, detail="Reduction quantity must be greater than zero")
        new_qty = prev_qty - payload.quantity
        if new_qty < 0:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}: available {prev_qty}, requested reduction {payload.quantity}",
            )
    elif payload.movement_type == "ADJUSTMENT":
        if payload.quantity < 0:
            raise HTTPException(status_code=400, detail="Adjusted stock cannot be negative")
        new_qty = payload.quantity
    else:
        raise HTTPException(status_code=400, detail="Invalid movement type")

    product.current_stock = new_qty
    movement = InventoryMovement(
        user_id=user_id,
        product_id=product.id,
        movement_type=payload.movement_type,
        quantity=payload.quantity,
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        reason=payload.reason,
        is_demo=False,
    )
    db.add(movement)
    db.flush()

    recalculate_product_risk(db, user_id, product)
    db.commit()
    db.refresh(movement)
    return movement


def create_sale_transaction(db: Session, user_id: int, payload: SaleCreate) -> Sale:
    try:
        sale_dt = payload.sale_date or datetime.now(timezone.utc)
        subtotal = Decimal("0.00")
        sale_items_to_create = []
        touched_products = []

        # Consolidate duplicate product IDs in same cart
        merged_quantities: dict[int, int] = {}
        for item in payload.items:
            merged_quantities[item.product_id] = merged_quantities.get(item.product_id, 0) + item.quantity

        for product_id, qty in merged_quantities.items():
            if qty <= 0:
                raise HTTPException(status_code=400, detail="Sale quantity must be greater than zero")

            product = (
                db.query(Product)
                .filter(Product.id == product_id, Product.user_id == user_id)
                .with_for_update()
                .first()
            )
            if not product:
                raise HTTPException(status_code=404, detail=f"Product ID {product_id} not found")

            if product.current_stock < qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {product.name}: available {product.current_stock}, requested {qty}",
                )

            unit_price = Decimal(str(product.selling_price))
            line_total = (unit_price * Decimal(qty)).quantize(Decimal("0.01"))
            subtotal += line_total

            prev_qty = int(product.current_stock)
            product.current_stock = prev_qty - qty

            sale_items_to_create.append(
                {
                    "product": product,
                    "quantity": qty,
                    "unit_price": unit_price,
                    "line_total": line_total,
                    "prev_qty": prev_qty,
                    "new_qty": product.current_stock,
                }
            )
            touched_products.append(product)

        ref_num = f"SAL-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        sale = Sale(
            user_id=user_id,
            reference_number=ref_num,
            subtotal=subtotal,
            total_amount=subtotal,
            notes=payload.notes,
            sale_date=sale_dt,
            is_demo=False,
        )
        db.add(sale)
        db.flush()

        for entry in sale_items_to_create:
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=entry["product"].id,
                quantity=entry["quantity"],
                unit_price=entry["unit_price"],
                line_total=entry["line_total"],
            )
            db.add(sale_item)

            movement = InventoryMovement(
                user_id=user_id,
                product_id=entry["product"].id,
                movement_type="SALE",
                quantity=entry["quantity"],
                previous_quantity=entry["prev_qty"],
                new_quantity=entry["new_qty"],
                reason=f"Sale transaction {ref_num}",
                is_demo=False,
                created_at=sale_dt,
            )
            db.add(movement)

        db.flush()
        for p in touched_products:
            recalculate_product_risk(db, user_id, p)

        db.commit()
        db.refresh(sale)
        return sale
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record sale transaction: {str(exc)}")
