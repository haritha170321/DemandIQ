from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc, or_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.catalog import ProductCreate, ProductOut, ProductUpdate
from app.services.risk_service import recalculate_product_risk

router = APIRouter(prefix="/api/products", tags=["Products"])


def _compute_stock_status(product: Product) -> str:
    if product.current_stock == 0:
        return "OUT_OF_STOCK"
    if product.current_stock <= product.minimum_stock:
        return "LOW_STOCK"
    return "IN_STOCK"


def _serialize_product(product: Product, supplier_name: Optional[str] = None) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        sku=product.sku,
        category=product.category,
        description=product.description,
        selling_price=float(product.selling_price),
        cost_price=float(product.cost_price),
        current_stock=product.current_stock,
        minimum_stock=product.minimum_stock,
        reorder_level=product.reorder_level,
        supplier_id=product.supplier_id,
        supplier_name=supplier_name or (product.supplier.name if product.supplier else None),
        stock_status=_compute_stock_status(product),
        is_demo=product.is_demo,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


def _get_or_create_category(db: Session, user_id: int, category_name: str) -> Category:
    cat = db.query(Category).filter(Category.user_id == user_id, Category.name == category_name).first()
    if not cat:
        cat = Category(user_id=user_id, name=category_name)
        db.add(cat)
        db.flush()
    return cat


@router.get("")
def list_products(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    stock_status: Optional[str] = Query(default=None),
    sort_by: str = Query(default="updated_at"),
    sort_order: str = Query(default="desc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.user_id == current_user.id)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(Product.name.ilike(term), Product.sku.ilike(term), Product.category.ilike(term)))
    if category and category != "ALL":
        query = query.filter(Product.category == category)
    if stock_status == "OUT_OF_STOCK":
        query = query.filter(Product.current_stock == 0)
    elif stock_status == "LOW_STOCK":
        query = query.filter(Product.current_stock > 0, Product.current_stock <= Product.minimum_stock)
    elif stock_status == "IN_STOCK":
        query = query.filter(Product.current_stock > Product.minimum_stock)

    allowed_sort = {
        "name": Product.name,
        "sku": Product.sku,
        "category": Product.category,
        "selling_price": Product.selling_price,
        "cost_price": Product.cost_price,
        "current_stock": Product.current_stock,
        "updated_at": Product.updated_at,
    }
    sort_col = allowed_sort.get(sort_by, Product.updated_at)
    query = query.order_by(asc(sort_col) if sort_order == "asc" else desc(sort_col))

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    categories = [
        c[0]
        for c in db.query(Product.category).filter(Product.user_id == current_user.id).distinct().all()
    ]

    return {
        "items": [_serialize_product(p) for p in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "categories": sorted(categories),
    }


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_sku = (
        db.query(Product)
        .filter(Product.user_id == current_user.id, Product.sku == payload.sku.strip())
        .first()
    )
    if existing_sku:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"SKU '{payload.sku}' already exists")

    if payload.supplier_id is not None:
        supplier = (
            db.query(Supplier)
            .filter(Supplier.id == payload.supplier_id, Supplier.user_id == current_user.id)
            .first()
        )
        if not supplier:
            raise HTTPException(status_code=404, detail="Selected supplier not found")

    category_obj = _get_or_create_category(db, current_user.id, payload.category.strip())
    product = Product(
        user_id=current_user.id,
        category_id=category_obj.id,
        supplier_id=payload.supplier_id,
        name=payload.name.strip(),
        sku=payload.sku.strip(),
        category=payload.category.strip(),
        description=payload.description,
        selling_price=payload.selling_price,
        cost_price=payload.cost_price,
        current_stock=payload.current_stock,
        minimum_stock=payload.minimum_stock,
        reorder_level=payload.reorder_level,
        is_demo=False,
    )
    db.add(product)
    db.flush()
    recalculate_product_risk(db, current_user.id, product)
    db.commit()
    db.refresh(product)
    return _serialize_product(product)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _serialize_product(product)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.sku and payload.sku.strip() != product.sku:
        dup = (
            db.query(Product)
            .filter(Product.user_id == current_user.id, Product.sku == payload.sku.strip(), Product.id != product.id)
            .first()
        )
        if dup:
            raise HTTPException(status_code=409, detail=f"SKU '{payload.sku}' already exists")
        product.sku = payload.sku.strip()

    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.category is not None:
        cat = _get_or_create_category(db, current_user.id, payload.category.strip())
        product.category = payload.category.strip()
        product.category_id = cat.id
    if payload.description is not None:
        product.description = payload.description
    if payload.selling_price is not None:
        product.selling_price = payload.selling_price
    if payload.cost_price is not None:
        product.cost_price = payload.cost_price
    if float(product.selling_price) < float(product.cost_price):
        raise HTTPException(status_code=400, detail="Selling price cannot be less than cost price")
    if payload.current_stock is not None:
        product.current_stock = payload.current_stock
    if payload.minimum_stock is not None:
        product.minimum_stock = payload.minimum_stock
    if payload.reorder_level is not None:
        product.reorder_level = payload.reorder_level
    if payload.supplier_id is not None:
        supplier = (
            db.query(Supplier)
            .filter(Supplier.id == payload.supplier_id, Supplier.user_id == current_user.id)
            .first()
        )
        if not supplier:
            raise HTTPException(status_code=404, detail="Selected supplier not found")
        product.supplier_id = payload.supplier_id

    recalculate_product_risk(db, current_user.id, product)
    db.commit()
    db.refresh(product)
    return _serialize_product(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)
    db.commit()
    return None
