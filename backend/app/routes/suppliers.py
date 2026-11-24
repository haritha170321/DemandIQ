from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.purchase_order import SupplierDelivery
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.catalog import (
    SupplierCreate,
    SupplierDeliveryCreate,
    SupplierDeliveryOut,
    SupplierOut,
    SupplierUpdate,
)
from app.services.supplier_service import analyze_supplier_risks

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])


@router.get("/risks")
def get_supplier_risks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {"items": analyze_supplier_risks(db, current_user.id)}


@router.get("", response_model=List[SupplierOut])
def list_suppliers(
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Supplier).filter(Supplier.user_id == current_user.id)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(Supplier.name.ilike(term), Supplier.contact_person.ilike(term), Supplier.email.ilike(term))
        )
    return query.order_by(Supplier.name.asc()).all()


@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dup = (
        db.query(Supplier)
        .filter(Supplier.user_id == current_user.id, Supplier.name == payload.name.strip())
        .first()
    )
    if dup:
        raise HTTPException(status_code=409, detail=f"Supplier '{payload.name}' already exists")

    supplier = Supplier(
        user_id=current_user.id,
        name=payload.name.strip(),
        contact_person=payload.contact_person.strip(),
        email=payload.email.lower(),
        phone=payload.phone.strip(),
        address=payload.address,
        avg_lead_time_days=payload.avg_lead_time_days,
        reliability_status=payload.reliability_status,
        is_demo=False,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: SupplierUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.user_id == current_user.id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if payload.name is not None:
        supplier.name = payload.name.strip()
    if payload.contact_person is not None:
        supplier.contact_person = payload.contact_person.strip()
    if payload.email is not None:
        supplier.email = payload.email.lower()
    if payload.phone is not None:
        supplier.phone = payload.phone.strip()
    if payload.address is not None:
        supplier.address = payload.address
    if payload.avg_lead_time_days is not None:
        supplier.avg_lead_time_days = payload.avg_lead_time_days
    if payload.reliability_status is not None:
        supplier.reliability_status = payload.reliability_status

    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.user_id == current_user.id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(supplier)
    db.commit()
    return None


@router.get("/{supplier_id}/deliveries", response_model=List[SupplierDeliveryOut])
def get_supplier_deliveries(
    supplier_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == supplier_id, Supplier.user_id == current_user.id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return (
        db.query(SupplierDelivery)
        .filter(SupplierDelivery.supplier_id == supplier_id, SupplierDelivery.user_id == current_user.id)
        .order_by(SupplierDelivery.expected_delivery_date.desc())
        .all()
    )


@router.post("/deliveries", response_model=SupplierDeliveryOut, status_code=status.HTTP_201_CREATED)
def log_supplier_delivery(
    payload: SupplierDeliveryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    supplier = (
        db.query(Supplier)
        .filter(Supplier.id == payload.supplier_id, Supplier.user_id == current_user.id)
        .first()
    )
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    if payload.actual_delivery_date:
        delay = (payload.actual_delivery_date - payload.expected_delivery_date).days
        status_label = "DELAYED" if delay > 0 else "ON_TIME"
    else:
        delay = 0
        status_label = "PENDING"

    delivery = SupplierDelivery(
        user_id=current_user.id,
        supplier_id=supplier.id,
        po_reference=payload.po_reference.strip(),
        expected_delivery_date=payload.expected_delivery_date,
        actual_delivery_date=payload.actual_delivery_date,
        delay_days=max(0, delay),
        delivery_status=status_label,
        is_demo=False,
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    analyze_supplier_risks(db, current_user.id)
    return delivery
