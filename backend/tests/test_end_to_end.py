from datetime import date, datetime, timedelta, timezone


def _create_supplier(client, headers, name="Fresh Dairy Co."):
    resp = client.post(
        "/api/suppliers",
        headers=headers,
        json={
            "name": name,
            "contact_person": "Rohan Verma",
            "email": "rohan@freshdairy.in",
            "phone": "+91-9876543210",
            "avg_lead_time_days": 4,
            "reliability_status": "Reliable",
        },
    )
    assert resp.status_code == 201
    return resp.json()


def _create_product(client, headers, supplier_id, name="Milk 1L", sku="MLK-01", stock=50, sell=68, cost=50):
    resp = client.post(
        "/api/products",
        headers=headers,
        json={
            "name": name,
            "sku": sku,
            "category": "Dairy",
            "selling_price": sell,
            "cost_price": cost,
            "current_stock": stock,
            "minimum_stock": 15,
            "reorder_level": 25,
            "supplier_id": supplier_id,
        },
    )
    assert resp.status_code == 201
    return resp.json()


def test_product_supplier_inventory_and_sales_lifecycle(client, auth_headers):
    sup = _create_supplier(client, auth_headers)
    prod = _create_product(client, auth_headers, sup["id"], stock=40)

    # Duplicate SKU blocked
    dup_prod = client.post(
        "/api/products",
        headers=auth_headers,
        json={
            "name": "Milk Duplicate",
            "sku": "MLK-01",
            "category": "Dairy",
            "selling_price": 70,
            "cost_price": 50,
            "current_stock": 10,
        },
    )
    assert dup_prod.status_code == 409

    # Inventory addition
    mv = client.post(
        "/api/inventory/movements",
        headers=auth_headers,
        json={"product_id": prod["id"], "movement_type": "ADDITION", "quantity": 10, "reason": "Restock"},
    )
    assert mv.status_code == 201
    assert mv.json()["new_quantity"] == 50

    # Prevent negative stock reduction
    bad_mv = client.post(
        "/api/inventory/movements",
        headers=auth_headers,
        json={"product_id": prod["id"], "movement_type": "REDUCTION", "quantity": 999, "reason": "Damaged"},
    )
    assert bad_mv.status_code == 400

    # Transactional sale creation reduces stock and creates movement
    sale = client.post(
        "/api/sales",
        headers=auth_headers,
        json={"items": [{"product_id": prod["id"], "quantity": 8}], "notes": "POS Test"},
    )
    assert sale.status_code == 201
    assert sale.json()["total_amount"] == 544.0

    updated_prod = client.get(f"/api/products/{prod['id']}", headers=auth_headers).json()
    assert updated_prod["current_stock"] == 42

    # Insufficient stock sale rolls back cleanly
    bad_sale = client.post(
        "/api/sales",
        headers=auth_headers,
        json={"items": [{"product_id": prod["id"], "quantity": 500}]},
    )
    assert bad_sale.status_code == 400
    after_rollback = client.get(f"/api/products/{prod['id']}", headers=auth_headers).json()
    assert after_rollback["current_stock"] == 42


def test_forecasting_risks_reorder_discount_supplier_and_analytics(client, auth_headers):
    sup = _create_supplier(client, auth_headers, "Deccan Agro")
    active = _create_product(client, auth_headers, sup["id"], name="Rice 5kg", sku="RIC-5", stock=18, sell=540, cost=410)
    stagnant = _create_product(client, auth_headers, sup["id"], name="Matcha Tin", sku="MTC-1", stock=40, sell=400, cost=250)

    # Empty sales history fallback
    empty_fc = client.get(f"/api/forecast/{stagnant['id']}?horizon_days=30", headers=auth_headers)
    assert empty_fc.status_code == 200
    assert empty_fc.json()["sufficient_data"] is False
    assert empty_fc.json()["predicted_total_demand"] == 0.0

    # Create 40 days of historical sales for active SKU
    now = datetime.now(timezone.utc)
    # Top up stock first so 40 days of sales succeed
    client.post(
        "/api/inventory/movements",
        headers=auth_headers,
        json={"product_id": active["id"], "movement_type": "ADDITION", "quantity": 500, "reason": "Seed"},
    )
    for d in range(40, 0, -1):
        dt = (now - timedelta(days=d)).isoformat()
        r = client.post(
            "/api/sales",
            headers=auth_headers,
            json={"items": [{"product_id": active["id"], "quantity": 5 + (d % 3)}], "sale_date": dt},
        )
        assert r.status_code == 201

    # Reduce stock back to low level to trigger HIGH stockout risk & reorder
    client.post(
        "/api/inventory/movements",
        headers=auth_headers,
        json={"product_id": active["id"], "movement_type": "ADJUSTMENT", "quantity": 12, "reason": "Audit"},
    )

    fc = client.get(f"/api/forecast/{active['id']}?horizon_days=30", headers=auth_headers)
    assert fc.status_code == 200
    fc_data = fc.json()
    assert fc_data["sufficient_data"] is True
    assert fc_data["mae"] is not None
    assert fc_data["rmse"] is not None
    assert len(fc_data["forecast_series"]) == 30

    # Stockout risks
    risks = client.get("/api/risks", headers=auth_headers).json()["items"]
    rice_risk = next(r for r in risks if r["product_id"] == active["id"])
    assert rice_risk["risk_level"] == "HIGH"

    # Budget-aware reorder strictly within budget
    reorder = client.post("/api/recommendations/reorder", headers=auth_headers, json={"budget": 5000}).json()
    assert reorder["total_allocated_cost"] <= 5000.0
    assert reorder["remaining_budget"] >= 0.0

    # Discount recommendation respects minimum profit margin
    discounts = client.post(
        "/api/recommendations/discount",
        headers=auth_headers,
        json={"min_profit_margin_pct": 15.0, "slow_moving_days_threshold": 0},
    ).json()["items"]
    for disc in discounts:
        new_price = disc["new_selling_price"]
        cost = disc["cost_price"]
        actual_margin_pct = ((new_price - cost) / new_price) * 100.0
        assert actual_margin_pct >= 14.9

    # Supplier delivery risk with insufficient deliveries
    s_risks = client.get("/api/suppliers/risks", headers=auth_headers).json()["items"]
    assert s_risks[0]["risk_level"] == "INSUFFICIENT_DATA"

    # Log 3 delayed deliveries -> HIGH risk
    for i in range(3):
        exp = date.today() - timedelta(days=10 + i)
        act = exp + timedelta(days=4)
        client.post(
            "/api/suppliers/deliveries",
            headers=auth_headers,
            json={
                "supplier_id": sup["id"],
                "po_reference": f"PO-{i}",
                "expected_delivery_date": exp.isoformat(),
                "actual_delivery_date": act.isoformat(),
            },
        )
    s_risks_after = client.get("/api/suppliers/risks", headers=auth_headers).json()["items"]
    assert s_risks_after[0]["risk_level"] == "HIGH"

    # Decision Center & Alerts & Analytics
    decisions = client.get("/api/decisions", headers=auth_headers).json()["items"]
    assert len(decisions) >= 1

    alerts = client.get("/api/alerts", headers=auth_headers).json()
    assert len(alerts["items"]) >= 1

    summary = client.get("/api/dashboard/summary", headers=auth_headers).json()
    assert summary["kpis"]["total_products"] == 2
    assert summary["kpis"]["high_risk_products"] >= 1
