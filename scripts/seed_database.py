"""Seed realistic 6-month demo dataset into PostgreSQL for DemandIQ.

Usage:
    cd backend
    python ../scripts/seed_database.py
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import math
import os
import sys

# Ensure backend/app is importable
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models import (
    Category,
    InventoryMovement,
    Product,
    Sale,
    SaleItem,
    Supplier,
    SupplierDelivery,
    User,
)
from app.services.recommendation_service import (
    generate_budget_reorder_recommendations,
    generate_discount_recommendations,
)
from app.services.risk_service import recalculate_all_risks
from app.services.supplier_service import analyze_supplier_risks


def seed_for_user(db, user: User) -> None:
    if db.query(Product).filter(Product.user_id == user.id).count() > 0:
        print(f"Database already contains products for {user.email}; skipping seed.")
        return

    now = datetime.now(timezone.utc)
    today = date.today()

    # 1. Categories
    category_names = [
        "Dairy & Fresh",
        "Staples & Grains",
        "Beverages",
        "Snacks & Bakery",
        "Personal Care",
        "Household Care",
    ]
    categories = {}
    for cname in category_names:
        c = Category(user_id=user.id, name=cname, description=f"Demo category: {cname}", is_demo=True)
        db.add(c)
        db.flush()
        categories[cname] = c

    # 2. Suppliers (6 suppliers: reliable, medium delay, high delay, insufficient history)
    suppliers_spec = [
        ("FreshValley Dairy Co.", "Ananya Deshmukh", "ananya@freshvalley.in", "+91-98201-11220", "Pune, MH", 2.0, "Reliable"),
        ("Deccan Agro Mills", "Rajeshwari Iyer", "supply@deccanagro.in", "+91-98450-44510", "Bengaluru, KA", 5.0, "Reliable"),
        ("Coastal Spice & Oil Ltd", "Vikram Malhotra", "vikram@coastalspices.in", "+91-98111-77234", "Kochi, KL", 7.0, "Watchlist"),
        ("Metro FMCG Distributors", "Karan Patel", "orders@metrofmcg.in", "+91-98250-33490", "Ahmedabad, GJ", 4.0, "Reliable"),
        ("Northern Highland Estates", "Meera Nair", "dispatch@northernhighland.in", "+91-98330-99102", "Siliguri, WB", 9.0, "At Risk"),
        ("Artisan Pantry Co.", "Siddharth Rao", "hello@artisanpantry.in", "+91-99001-55210", "Hyderabad, TS", 6.0, "New"),
    ]
    suppliers = {}
    for name, contact, email, phone, addr, lead, rel in suppliers_spec:
        s = Supplier(
            user_id=user.id,
            name=name,
            contact_person=contact,
            email=email,
            phone=phone,
            address=addr,
            avg_lead_time_days=lead,
            reliability_status=rel,
            is_demo=True,
        )
        db.add(s)
        db.flush()
        suppliers[name] = s

    # Delivery records (Coastal & Northern have delays; Artisan has only 2 -> insufficient data)
    delivery_patterns = {
        "FreshValley Dairy Co.": [0, 0, 0, 1, 0, 0, 0, 0],
        "Deccan Agro Mills": [0, 0, 1, 0, 0, 0, 2, 0],
        "Coastal Spice & Oil Ltd": [2, 3, 0, 4, 1, 0, 3],
        "Metro FMCG Distributors": [0, 0, 0, 0, 1, 0, 0],
        "Northern Highland Estates": [4, 5, 2, 6, 0, 4],
        "Artisan Pantry Co.": [0, 1],  # Only 2 completed deliveries -> insufficient data
    }
    for sname, delays in delivery_patterns.items():
        sup = suppliers[sname]
        for idx, d_days in enumerate(delays):
            exp_dt = today - timedelta(days=(len(delays) - idx) * 14)
            act_dt = exp_dt + timedelta(days=d_days)
            db.add(
                SupplierDelivery(
                    user_id=user.id,
                    supplier_id=sup.id,
                    po_reference=f"PO-DEMO-{sup.id}-{100 + idx}",
                    expected_delivery_date=exp_dt,
                    actual_delivery_date=act_dt,
                    delay_days=d_days,
                    delivery_status="DELAYED" if d_days > 0 else "ON_TIME",
                    is_demo=True,
                )
            )

    # 3. 22 Products covering increasing, decreasing, stable, low-stock, OOS, and slow-moving items
    # (name, sku, category, supplier, sell, cost, stock, min_stock, reorder_lvl, pattern, base_daily)
    products_spec = [
        ("Full Cream Milk 1L", "SKU-MLK-001", "Dairy & Fresh", "FreshValley Dairy Co.", 68.0, 52.0, 28, 30, 65, "increasing", 18.0),
        ("Greek Yogurt Cup 400g", "SKU-YGT-002", "Dairy & Fresh", "FreshValley Dairy Co.", 110.0, 78.0, 16, 20, 45, "increasing", 8.0),
        ("Salted Farm Butter 500g", "SKU-BTR-003", "Dairy & Fresh", "FreshValley Dairy Co.", 265.0, 205.0, 42, 15, 30, "stable", 4.5),
        ("Basmati Rice 5kg", "SKU-RIC-004", "Staples & Grains", "Deccan Agro Mills", 540.0, 410.0, 85, 25, 50, "stable", 6.5),
        ("Whole Wheat Flour 5kg", "SKU-WFL-005", "Staples & Grains", "Deccan Agro Mills", 260.0, 195.0, 22, 25, 55, "increasing", 9.0),
        ("Refined Cane Sugar 1kg", "SKU-SGR-006", "Staples & Grains", "Deccan Agro Mills", 54.0, 41.0, 110, 30, 60, "stable", 8.0),
        ("Cold-Pressed Cooking Oil 1L", "SKU-OIL-007", "Staples & Grains", "Coastal Spice & Oil Ltd", 195.0, 148.0, 34, 25, 55, "increasing", 7.5),
        ("Toor Dal Premium 1kg", "SKU-DAL-008", "Staples & Grains", "Deccan Agro Mills", 165.0, 128.0, 64, 20, 40, "stable", 4.2),
        ("Butter Crunch Biscuits 200g", "SKU-BSC-009", "Snacks & Bakery", "Metro FMCG Distributors", 45.0, 31.0, 140, 35, 70, "weekend_spike", 11.0),
        ("Roasted Almond Cookies 250g", "SKU-CKY-010", "Snacks & Bakery", "Artisan Pantry Co.", 220.0, 145.0, 68, 12, 25, "slow_moving", 0.3),
        ("Multigrain Oats 1kg", "SKU-OAT-011", "Snacks & Bakery", "Metro FMCG Distributors", 190.0, 132.0, 48, 15, 30, "decreasing", 3.2),
        ("Assam Leaf Tea 500g", "SKU-TEA-012", "Beverages", "Northern Highland Estates", 280.0, 205.0, 18, 20, 45, "stable", 4.0),
        ("Arabica Roast Coffee 250g", "SKU-COF-013", "Beverages", "Northern Highland Estates", 360.0, 250.0, 0, 15, 30, "increasing", 4.5),
        ("Matcha Green Tea Tin 100g", "SKU-MTC-014", "Beverages", "Artisan Pantry Co.", 420.0, 260.0, 54, 10, 20, "slow_moving", 0.2),
        ("Herbal Bath Soap Pack of 4", "SKU-SOP-015", "Personal Care", "Metro FMCG Distributors", 148.0, 102.0, 95, 25, 50, "stable", 5.5),
        ("Botanical Hair Shampoo 340ml", "SKU-SHP-016", "Personal Care", "Metro FMCG Distributors", 245.0, 168.0, 52, 18, 35, "decreasing", 2.8),
        ("Mint Fluoride Toothpaste 150g", "SKU-TPT-017", "Personal Care", "Metro FMCG Distributors", 98.0, 66.0, 84, 20, 40, "stable", 4.8),
        ("Charcoal Face Scrub 100g", "SKU-FSB-018", "Personal Care", "Artisan Pantry Co.", 295.0, 180.0, 62, 10, 20, "slow_moving", 0.25),
        ("Liquid Laundry Detergent 2L", "SKU-DTG-019", "Household Care", "Metro FMCG Distributors", 340.0, 245.0, 24, 18, 40, "increasing", 4.8),
        ("Citrus Dishwash Gel 750ml", "SKU-DSH-020", "Household Care", "Metro FMCG Distributors", 145.0, 98.0, 70, 20, 40, "stable", 3.8),
        ("Pine Floor Disinfectant 1L", "SKU-FLR-021", "Household Care", "Coastal Spice & Oil Ltd", 160.0, 110.0, 45, 15, 30, "decreasing", 2.2),
        ("Organic Honey Jar 500g", "SKU-HNY-022", "Staples & Grains", "Artisan Pantry Co.", 390.0, 255.0, 74, 12, 24, "slow_moving", 0.25),
    ]

    products: list[tuple[Product, str, float]] = []
    for name, sku, cat, sname, sell, cost, stock, min_s, reord, pattern, base in products_spec:
        p = Product(
            user_id=user.id,
            category_id=categories[cat].id,
            supplier_id=suppliers[sname].id,
            name=name,
            sku=sku,
            category=cat,
            description=f"Demo catalog item ({pattern.replace('_', ' ')})",
            selling_price=sell,
            cost_price=cost,
            current_stock=stock,
            minimum_stock=min_s,
            reorder_level=reord,
            is_demo=True,
            created_at=now - timedelta(days=190),
        )
        db.add(p)
        db.flush()
        products.append((p, pattern, base))

        # Initial opening stock movement
        db.add(
            InventoryMovement(
                user_id=user.id,
                product_id=p.id,
                movement_type="ADDITION",
                quantity=stock + 120,
                previous_quantity=0,
                new_quantity=stock + 120,
                reason="Initial warehouse opening balance (Demo Seed)",
                is_demo=True,
                created_at=now - timedelta(days=182),
            )
        )

    # 4. 180 days of coherent daily sales records
    for day_offset in range(180, 0, -1):
        sale_dt = now - timedelta(days=day_offset)
        dow = sale_dt.weekday()
        is_weekend = dow >= 5

        day_items = []
        subtotal = 0.0

        for idx, (prod, pattern, base) in enumerate(products):
            progress = (180 - day_offset) / 180.0
            wave = 1.0 + 0.14 * math.sin((day_offset + idx * 3) * 0.45)

            if pattern == "slow_moving":
                # Stagnant for last 35+ days so discount engine picks them up cleanly
                if day_offset <= 36:
                    qty = 0
                else:
                    qty = 1 if (day_offset + idx) % 6 == 0 else 0
            elif pattern == "increasing":
                mult = 0.72 + 0.68 * progress
                qty = max(1, int(round(base * mult * wave * (1.15 if is_weekend else 0.96))))
            elif pattern == "decreasing":
                mult = 1.35 - 0.65 * progress
                qty = max(0, int(round(base * mult * wave)))
            elif pattern == "weekend_spike":
                mult = 1.55 if is_weekend else 0.85
                qty = max(1, int(round(base * mult * wave)))
            else:
                qty = max(1, int(round(base * wave * (1.1 if is_weekend else 0.98))))

            if qty > 0:
                line_total = round(float(prod.selling_price) * qty, 2)
                subtotal += line_total
                day_items.append((prod, qty, float(prod.selling_price), line_total))

        if not day_items:
            continue

        sale = Sale(
            user_id=user.id,
            reference_number=f"SAL-DEMO-{sale_dt.strftime('%Y%m%d')}",
            subtotal=round(subtotal, 2),
            total_amount=round(subtotal, 2),
            notes="Seeded historical POS summary (Demo Data)",
            sale_date=sale_dt,
            is_demo=True,
            created_at=sale_dt,
        )
        db.add(sale)
        db.flush()

        for prod, qty, unit_p, line_t in day_items:
            db.add(
                SaleItem(
                    sale_id=sale.id,
                    product_id=prod.id,
                    quantity=qty,
                    unit_price=unit_p,
                    line_total=line_t,
                )
            )

    db.commit()

    # 5. Compute intelligence artifacts from real seeded data
    recalculate_all_risks(db, user.id)
    analyze_supplier_risks(db, user.id)
    generate_budget_reorder_recommendations(db, user.id, budget=user.default_budget)
    generate_discount_recommendations(db, user.id, min_profit_margin_pct=user.min_profit_margin_pct)
    db.commit()
    print(f"Successfully seeded 6 months of DemandIQ demo data for {user.email}.")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        demo_email = os.getenv("SEED_DEMO_EMAIL", "demo@demandiq.ai")
        demo_password = os.getenv("SEED_DEMO_PASSWORD", "DemandIQ#2026")
        user = db.query(User).filter(User.email == demo_email).first()
        if not user:
            user = User(
                email=demo_email,
                full_name="Arjun Mehta",
                business_name="DemandIQ Retail Operations",
                hashed_password=hash_password(demo_password),
                currency="INR",
                default_budget=50000.0,
                min_profit_margin_pct=10.0,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        seed_for_user(db, user)
    finally:
        db.close()


if __name__ == "__main__":
    main()
