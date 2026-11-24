import {
  AlertItem,
  DashboardSummary,
  DecisionInsight,
  DiscountRecommendation,
  ForecastResult,
  InventoryAnalytics,
  InventoryMovement,
  InventoryRisk,
  Product,
  ReorderPlanResponse,
  ReorderRecommendation,
  Sale,
  SalesAnalytics,
  Supplier,
  SupplierDelivery,
  SupplierRisk,
  User,
} from '../types';

const STORAGE_KEY = 'demandiq_preview_state_v1';

interface PreviewState {
  user: User;
  suppliers: Supplier[];
  deliveries: SupplierDelivery[];
  products: Product[];
  movements: InventoryMovement[];
  sales: Sale[];
  reorders: ReorderRecommendation[];
  discounts: DiscountRecommendation[];
  alerts: AlertItem[];
  nextIds: {
    supplier: number;
    delivery: number;
    product: number;
    movement: number;
    sale: number;
    saleItem: number;
    reorder: number;
    discount: number;
    alert: number;
  };
}

function isoDateDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function dateOnlyDaysAgo(daysAgo: number): string {
  return isoDateDaysAgo(daysAgo).slice(0, 10);
}

function dateOnlyDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function createSeedState(): PreviewState {
  const nowIso = new Date().toISOString();
  const createdOld = isoDateDaysAgo(190);

  const user: User = {
    id: 1,
    email: 'demo@demandiq.ai',
    full_name: 'Arjun Mehta',
    business_name: 'DemandIQ Retail Operations',
    role: 'owner',
    currency: 'INR',
    default_budget: 50000,
    min_profit_margin_pct: 10,
    created_at: createdOld,
  };

  const suppliersSpec: Array<[string, string, string, string, string, number, string]> = [
    ['FreshValley Dairy Co.', 'Ananya Deshmukh', 'ananya@freshvalley.in', '+91-98201-11220', 'Pune, MH', 2, 'Reliable'],
    ['Deccan Agro Mills', 'Rajeshwari Iyer', 'supply@deccanagro.in', '+91-98450-44510', 'Bengaluru, KA', 5, 'Reliable'],
    ['Coastal Spice & Oil Ltd', 'Vikram Malhotra', 'vikram@coastalspices.in', '+91-98111-77234', 'Kochi, KL', 7, 'Watchlist'],
    ['Metro FMCG Distributors', 'Karan Patel', 'orders@metrofmcg.in', '+91-98250-33490', 'Ahmedabad, GJ', 4, 'Reliable'],
    ['Northern Highland Estates', 'Meera Nair', 'dispatch@northernhighland.in', '+91-98330-99102', 'Siliguri, WB', 9, 'At Risk'],
    ['Artisan Pantry Co.', 'Siddharth Rao', 'hello@artisanpantry.in', '+91-99001-55210', 'Hyderabad, TS', 6, 'New'],
  ];

  const suppliers: Supplier[] = suppliersSpec.map((s, idx) => ({
    id: idx + 1,
    name: s[0],
    contact_person: s[1],
    email: s[2],
    phone: s[3],
    address: s[4],
    avg_lead_time_days: s[5],
    reliability_status: s[6],
    is_demo: true,
    created_at: createdOld,
    updated_at: nowIso,
  }));

  const deliveryPatterns: Record<number, number[]> = {
    1: [0, 0, 0, 1, 0, 0, 0, 0],
    2: [0, 0, 1, 0, 0, 0, 2, 0],
    3: [2, 3, 0, 4, 1, 0, 3],
    4: [0, 0, 0, 0, 1, 0, 0],
    5: [4, 5, 2, 6, 0, 4],
    6: [0, 1],
  };

  const deliveries: SupplierDelivery[] = [];
  let delId = 1;
  Object.entries(deliveryPatterns).forEach(([sidStr, delays]) => {
    const sid = Number(sidStr);
    delays.forEach((dDays, idx) => {
      const expDaysAgo = (delays.length - idx) * 14;
      const exp = dateOnlyDaysAgo(expDaysAgo);
      const act = dateOnlyDaysAgo(expDaysAgo - dDays);
      deliveries.push({
        id: delId++,
        supplier_id: sid,
        po_reference: `PO-DEMO-${sid}-${100 + idx}`,
        expected_delivery_date: exp,
        actual_delivery_date: act,
        delay_days: dDays,
        delivery_status: dDays > 0 ? 'DELAYED' : 'ON_TIME',
        is_demo: true,
        created_at: isoDateDaysAgo(expDaysAgo),
      });
    });
  });

  type Pattern = 'increasing' | 'decreasing' | 'stable' | 'weekend_spike' | 'slow_moving';
  const productsSpec: Array<[string, string, string, number, number, number, number, number, number, Pattern, number]> = [
    ['Full Cream Milk 1L', 'SKU-MLK-001', 'Dairy & Fresh', 1, 68, 52, 28, 30, 65, 'increasing', 18],
    ['Greek Yogurt Cup 400g', 'SKU-YGT-002', 'Dairy & Fresh', 1, 110, 78, 16, 20, 45, 'increasing', 8],
    ['Salted Farm Butter 500g', 'SKU-BTR-003', 'Dairy & Fresh', 1, 265, 205, 42, 15, 30, 'stable', 4.5],
    ['Basmati Rice 5kg', 'SKU-RIC-004', 'Staples & Grains', 2, 540, 410, 85, 25, 50, 'stable', 6.5],
    ['Whole Wheat Flour 5kg', 'SKU-WFL-005', 'Staples & Grains', 2, 260, 195, 22, 25, 55, 'increasing', 9],
    ['Refined Cane Sugar 1kg', 'SKU-SGR-006', 'Staples & Grains', 2, 54, 41, 110, 30, 60, 'stable', 8],
    ['Cold-Pressed Cooking Oil 1L', 'SKU-OIL-007', 'Staples & Grains', 3, 195, 148, 34, 25, 55, 'increasing', 7.5],
    ['Toor Dal Premium 1kg', 'SKU-DAL-008', 'Staples & Grains', 2, 165, 128, 64, 20, 40, 'stable', 4.2],
    ['Butter Crunch Biscuits 200g', 'SKU-BSC-009', 'Snacks & Bakery', 4, 45, 31, 140, 35, 70, 'weekend_spike', 11],
    ['Roasted Almond Cookies 250g', 'SKU-CKY-010', 'Snacks & Bakery', 6, 220, 145, 68, 12, 25, 'slow_moving', 0.3],
    ['Multigrain Oats 1kg', 'SKU-OAT-011', 'Snacks & Bakery', 4, 190, 132, 48, 15, 30, 'decreasing', 3.2],
    ['Assam Leaf Tea 500g', 'SKU-TEA-012', 'Beverages', 5, 280, 205, 18, 20, 45, 'stable', 4.0],
    ['Arabica Roast Coffee 250g', 'SKU-COF-013', 'Beverages', 5, 360, 250, 0, 15, 30, 'increasing', 4.5],
    ['Matcha Green Tea Tin 100g', 'SKU-MTC-014', 'Beverages', 6, 420, 260, 54, 10, 20, 'slow_moving', 0.2],
    ['Herbal Bath Soap Pack of 4', 'SKU-SOP-015', 'Personal Care', 4, 148, 102, 95, 25, 50, 'stable', 5.5],
    ['Botanical Hair Shampoo 340ml', 'SKU-SHP-016', 'Personal Care', 4, 245, 168, 52, 18, 35, 'decreasing', 2.8],
    ['Mint Fluoride Toothpaste 150g', 'SKU-TPT-017', 'Personal Care', 4, 98, 66, 84, 20, 40, 'stable', 4.8],
    ['Charcoal Face Scrub 100g', 'SKU-FSB-018', 'Personal Care', 6, 295, 180, 62, 10, 20, 'slow_moving', 0.25],
    ['Liquid Laundry Detergent 2L', 'SKU-DTG-019', 'Household Care', 4, 340, 245, 24, 18, 40, 'increasing', 4.8],
    ['Citrus Dishwash Gel 750ml', 'SKU-DSH-020', 'Household Care', 4, 145, 98, 70, 20, 40, 'stable', 3.8],
    ['Pine Floor Disinfectant 1L', 'SKU-FLR-021', 'Household Care', 3, 160, 110, 45, 15, 30, 'decreasing', 2.2],
    ['Organic Honey Jar 500g', 'SKU-HNY-022', 'Staples & Grains', 6, 390, 255, 74, 12, 24, 'slow_moving', 0.25],
  ];

  const products: Product[] = productsSpec.map((p, idx) => {
    const stock = p[6];
    const minStock = p[7];
    const sup = suppliers.find((s) => s.id === p[3]);
    return {
      id: idx + 1,
      name: p[0],
      sku: p[1],
      category: p[2],
      description: `Demo catalog item (${p[9].replace('_', ' ')})`,
      selling_price: p[4],
      cost_price: p[5],
      current_stock: stock,
      minimum_stock: minStock,
      reorder_level: p[8],
      supplier_id: p[3],
      supplier_name: sup?.name ?? null,
      stock_status: stock === 0 ? 'OUT_OF_STOCK' : stock <= minStock ? 'LOW_STOCK' : 'IN_STOCK',
      is_demo: true,
      created_at: createdOld,
      updated_at: nowIso,
    };
  });

  const movements: InventoryMovement[] = products.map((p, idx) => ({
    id: idx + 1,
    product_id: p.id,
    product_name: p.name,
    sku: p.sku,
    movement_type: 'ADDITION',
    quantity: p.current_stock + 120,
    previous_quantity: 0,
    new_quantity: p.current_stock + 120,
    reason: 'Initial warehouse opening balance (Demo Seed)',
    is_demo: true,
    created_at: isoDateDaysAgo(182),
  }));

  const sales: Sale[] = [];
  let saleId = 1;
  let saleItemId = 1;

  for (let dayOffset = 180; dayOffset >= 1; dayOffset--) {
    const saleIso = isoDateDaysAgo(dayOffset);
    const dObj = new Date(saleIso);
    const dow = dObj.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;

    const items: Sale['items'] = [];
    let subtotal = 0;

    productsSpec.forEach((spec, idx) => {
      const prod = products[idx];
      const pattern = spec[9];
      const base = spec[10];
      const progress = (180 - dayOffset) / 180;
      const wave = 1 + 0.14 * Math.sin((dayOffset + idx * 3) * 0.45);
      let qty = 0;

      if (pattern === 'slow_moving') {
        qty = dayOffset <= 36 ? 0 : (dayOffset + idx) % 6 === 0 ? 1 : 0;
      } else if (pattern === 'increasing') {
        qty = Math.max(1, Math.round(base * (0.72 + 0.68 * progress) * wave * (isWeekend ? 1.15 : 0.96)));
      } else if (pattern === 'decreasing') {
        qty = Math.max(0, Math.round(base * (1.35 - 0.65 * progress) * wave));
      } else if (pattern === 'weekend_spike') {
        qty = Math.max(1, Math.round(base * (isWeekend ? 1.55 : 0.85) * wave));
      } else {
        qty = Math.max(1, Math.round(base * wave * (isWeekend ? 1.1 : 0.98)));
      }

      if (qty > 0) {
        const lineTotal = Number((prod.selling_price * qty).toFixed(2));
        subtotal += lineTotal;
        items.push({
          id: saleItemId++,
          product_id: prod.id,
          product_name: prod.name,
          sku: prod.sku,
          quantity: qty,
          unit_price: prod.selling_price,
          line_total: lineTotal,
        });
      }
    });

    if (items.length > 0) {
      sales.push({
        id: saleId++,
        reference_number: `SAL-DEMO-${saleIso.slice(0, 10).replace(/-/g, '')}`,
        subtotal: Number(subtotal.toFixed(2)),
        total_amount: Number(subtotal.toFixed(2)),
        notes: 'Seeded historical POS summary (Demo Data)',
        sale_date: saleIso,
        is_demo: true,
        items,
      });
    }
  }

  const state: PreviewState = {
    user,
    suppliers,
    deliveries,
    products,
    movements,
    sales: sales.reverse(),
    reorders: [],
    discounts: [],
    alerts: [],
    nextIds: {
      supplier: suppliers.length + 1,
      delivery: delId,
      product: products.length + 1,
      movement: movements.length + 1,
      sale: saleId,
      saleItem: saleItemId,
      reorder: 1,
      discount: 1,
      alert: 1,
    },
  };

  syncAlerts(state);
  generateReordersInternal(state, user.default_budget);
  generateDiscountsInternal(state, user.min_profit_margin_pct, 21);
  return state;
}

function loadState(): PreviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PreviewState;
  } catch {
    // ignore storage errors
  }
  const seeded = createSeedState();
  saveState(seeded);
  return seeded;
}

function saveState(state: PreviewState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function computeStockStatus(p: Product): Product['stock_status'] {
  if (p.current_stock === 0) return 'OUT_OF_STOCK';
  if (p.current_stock <= p.minimum_stock) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function get30DaySalesMap(state: PreviewState): Map<number, number> {
  const cutoff = Date.now() - 30 * 86400_000;
  const map = new Map<number, number>();
  for (const s of state.sales) {
    if (new Date(s.sale_date).getTime() >= cutoff) {
      for (const it of s.items) {
        map.set(it.product_id, (map.get(it.product_id) ?? 0) + it.quantity);
      }
    }
  }
  return map;
}

function computeRisks(state: PreviewState): InventoryRisk[] {
  const sales30 = get30DaySalesMap(state);
  const nowIso = new Date().toISOString();

  return state.products
    .map((p) => {
      const sup = state.suppliers.find((s) => s.id === p.supplier_id);
      const leadTime = sup ? sup.avg_lead_time_days : 5;
      const total30 = sales30.get(p.id) ?? 0;
      const avgDaily = Number((total30 / 30).toFixed(2));
      const daysRemaining = avgDaily > 0.01 ? Number((p.current_stock / avgDaily).toFixed(1)) : null;
      const expectedDate =
        daysRemaining !== null ? dateOnlyDaysFromNow(Math.max(0, Math.round(daysRemaining))) : null;

      let riskLevel: InventoryRisk['risk_level'] = 'LOW';
      let action = 'Inventory coverage is healthy relative to daily demand and supplier lead time.';

      if (p.current_stock === 0 || (daysRemaining !== null && daysRemaining <= leadTime + 2) || p.current_stock <= p.minimum_stock) {
        riskLevel = 'HIGH';
        if (p.current_stock === 0) {
          action = `Out of stock. Place an immediate replenishment order with lead time ${leadTime} days.`;
        } else if (daysRemaining !== null && daysRemaining <= leadTime) {
          action = `Urgent reorder needed: ${daysRemaining} days of cover is below ${leadTime}-day supplier lead time.`;
        } else {
          action = `Stock (${p.current_stock}) is at or below minimum threshold (${p.minimum_stock}). Initiate reorder.`;
        }
      } else if ((daysRemaining !== null && daysRemaining <= leadTime + 10) || p.current_stock <= p.reorder_level) {
        riskLevel = 'MEDIUM';
        action = `Approaching reorder level (${p.reorder_level} units). Schedule purchase order before ${expectedDate ?? 'stock depletion'}.`;
      }

      return {
        product_id: p.id,
        product_name: p.name,
        sku: p.sku,
        category: p.category,
        available_stock: p.current_stock,
        avg_daily_demand: avgDaily,
        predicted_daily_demand: avgDaily,
        days_remaining: daysRemaining,
        expected_stockout_date: expectedDate,
        supplier_lead_time_days: leadTime,
        risk_level: riskLevel,
        recommended_action: action,
        calculated_at: nowIso,
      };
    })
    .sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const diff = rank[a.risk_level] - rank[b.risk_level];
      if (diff !== 0) return diff;
      return (a.days_remaining ?? 999) - (b.days_remaining ?? 999);
    });
}

function computeSupplierRisks(state: PreviewState): SupplierRisk[] {
  return state.suppliers
    .map((sup) => {
      const completed = state.deliveries.filter(
        (d) => d.supplier_id === sup.id && d.actual_delivery_date != null,
      );
      const total = completed.length;
      const onTime = completed.filter((d) => d.delay_days <= 0).length;
      const delayed = completed.filter((d) => d.delay_days > 0).length;
      const linked = state.products.filter((p) => p.supplier_id === sup.id).length;
      const delayPct = total > 0 ? Number(((delayed / total) * 100).toFixed(1)) : 0;
      const avgDelay = total > 0 ? Number((completed.reduce((s, d) => s + Math.max(0, d.delay_days), 0) / total).toFixed(1)) : 0;
      const avgTime = Number((sup.avg_lead_time_days + avgDelay).toFixed(1));

      let riskLevel: SupplierRisk['risk_level'] = 'LOW';
      let assessment = `Consistent on-time performance (${onTime}/${total} deliveries on schedule).`;

      if (total < 3) {
        riskLevel = 'INSUFFICIENT_DATA';
        assessment = `Insufficient historical records (${total} completed deliveries). Log at least 3 deliveries to establish reliable delay risk.`;
      } else if (delayPct >= 40 || avgDelay >= 3) {
        riskLevel = 'HIGH';
        assessment = `${delayPct.toFixed(0)}% of deliveries arrived late (avg delay ${avgDelay} days). Increase safety stock or qualify a backup vendor.`;
      } else if (delayPct >= 20 || avgDelay >= 1.5) {
        riskLevel = 'MEDIUM';
        assessment = `Moderate delay rate (${delayPct.toFixed(0)}%). Monitor upcoming purchase orders closely.`;
      }

      return {
        supplier_id: sup.id,
        supplier_name: sup.name,
        contact_person: sup.contact_person,
        email: sup.email,
        avg_lead_time_days: sup.avg_lead_time_days,
        total_deliveries: total,
        on_time_deliveries: onTime,
        delayed_deliveries: delayed,
        avg_delivery_time_days: avgTime,
        delay_percentage: delayPct,
        risk_level: riskLevel,
        insufficient_records: total < 3,
        linked_products: linked,
        assessment,
      };
    })
    .sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));
}

function upsertAlertInternal(
  state: PreviewState,
  category: string,
  severity: AlertItem['severity'],
  message: string,
  dedupeKey: string,
  relatedProductId?: number,
  relatedSupplierId?: number,
) {
  const existing = state.alerts.find(
    (a) => !a.is_resolved && a.category === category && a.related_product_id === (relatedProductId ?? null) && a.related_supplier_id === (relatedSupplierId ?? null) && a.message.startsWith(dedupeKey.slice(0, 0)),
  );
  // Better: match by category + related ids
  const match = state.alerts.find(
    (a) =>
      !a.is_resolved &&
      a.category === category &&
      (a.related_product_id ?? null) === (relatedProductId ?? null) &&
      (a.related_supplier_id ?? null) === (relatedSupplierId ?? null),
  );
  if (match || existing) {
    const target = match ?? existing!;
    target.severity = severity;
    target.message = message;
    return;
  }
  state.alerts.unshift({
    id: state.nextIds.alert++,
    category,
    severity,
    message,
    related_product_id: relatedProductId ?? null,
    related_supplier_id: relatedSupplierId ?? null,
    is_read: false,
    is_resolved: false,
    created_at: new Date().toISOString(),
  });
}

function resolveAlertsInternal(state: PreviewState, category: string, relatedProductId?: number, relatedSupplierId?: number) {
  state.alerts.forEach((a) => {
    if (
      !a.is_resolved &&
      a.category === category &&
      (a.related_product_id ?? null) === (relatedProductId ?? null) &&
      (a.related_supplier_id ?? null) === (relatedSupplierId ?? null)
    ) {
      a.is_resolved = true;
    }
  });
}

function syncAlerts(state: PreviewState) {
  const risks = computeRisks(state);
  const supRisks = computeSupplierRisks(state);

  for (const p of state.products) {
    if (p.current_stock === 0) {
      upsertAlertInternal(state, 'OUT_OF_STOCK', 'HIGH', `${p.name} (${p.sku}) is out of stock.`, `oos:${p.id}`, p.id);
      resolveAlertsInternal(state, 'LOW_INVENTORY', p.id);
    } else if (p.current_stock <= p.minimum_stock) {
      resolveAlertsInternal(state, 'OUT_OF_STOCK', p.id);
      upsertAlertInternal(
        state,
        'LOW_INVENTORY',
        'HIGH',
        `${p.name} is at ${p.current_stock} units (minimum stock: ${p.minimum_stock}).`,
        `low:${p.id}`,
        p.id,
      );
    } else {
      resolveAlertsInternal(state, 'OUT_OF_STOCK', p.id);
      resolveAlertsInternal(state, 'LOW_INVENTORY', p.id);
    }
  }

  for (const r of risks) {
    if (r.risk_level === 'HIGH' && r.days_remaining !== null && r.available_stock > 0) {
      upsertAlertInternal(
        state,
        'EXPECTED_STOCKOUT',
        'HIGH',
        `${r.product_name} projected to stock out in ${r.days_remaining} days (${r.expected_stockout_date}), inside ${r.supplier_lead_time_days}-day lead time.`,
        `so:${r.product_id}`,
        r.product_id,
      );
    } else {
      resolveAlertsInternal(state, 'EXPECTED_STOCKOUT', r.product_id);
    }
  }

  for (const sr of supRisks) {
    if (sr.risk_level === 'HIGH') {
      upsertAlertInternal(
        state,
        'SUPPLIER_DELAY_RISK',
        'HIGH',
        `Supplier ${sr.supplier_name} has a ${sr.delay_percentage.toFixed(0)}% delay rate across ${sr.total_deliveries} deliveries.`,
        `sr:${sr.supplier_id}`,
        undefined,
        sr.supplier_id,
      );
    } else {
      resolveAlertsInternal(state, 'SUPPLIER_DELAY_RISK', undefined, sr.supplier_id);
    }
  }
}

function generateReordersInternal(state: PreviewState, budget: number): ReorderPlanResponse {
  const risks = computeRisks(state);
  const riskByPid = new Map(risks.map((r) => [r.product_id, r]));

  const candidates = state.products
    .map((p) => {
      const risk = riskByPid.get(p.id)!;
      const avgDaily = risk.avg_daily_demand;
      const leadTime = risk.supplier_lead_time_days;
      const safetyStock = Math.max(p.minimum_stock, Math.ceil(avgDaily * Math.max(3, leadTime * 0.5)));
      const targetStock = Math.max(
        p.reorder_level + safetyStock,
        Math.ceil(avgDaily * (leadTime + 21)) + safetyStock,
      );
      const neededQty = Math.max(0, targetStock - p.current_stock);
      if (neededQty <= 0) return null;

      const unitProfit = Math.max(0, p.selling_price - p.cost_price);
      const marginRatio = p.selling_price > 0 ? unitProfit / p.selling_price : 0;
      const riskWeight = risk.risk_level === 'HIGH' ? 100 : risk.risk_level === 'MEDIUM' ? 55 : 20;
      const daysRem = risk.days_remaining ?? 999;
      const urgencyBonus = Math.max(0, 40 - Math.min(daysRem, 40));
      const profitImportance = Math.min(30, (avgDaily * unitProfit) / 25 + marginRatio * 20);
      const priorityScore = Number((riskWeight + urgencyBonus + profitImportance).toFixed(2));

      return { p, risk, neededQty, safetyStock, priorityScore, avgDaily, leadTime };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const totalIdealCost = Number(
    candidates.reduce((s, c) => s + c.neededQty * c.p.cost_price, 0).toFixed(2),
  );

  // Preserve accepted/rejected history; replace pending
  state.reorders = state.reorders.filter((r) => r.status !== 'PENDING');

  let remaining = budget;
  let rank = 1;
  const created: ReorderRecommendation[] = [];

  for (const c of candidates) {
    if (c.p.cost_price <= 0 || remaining < c.p.cost_price) continue;
    const maxAffordable = Math.floor(remaining / c.p.cost_price);
    const qty = Math.min(c.neededQty, maxAffordable);
    if (qty <= 0) continue;

    const lineCost = Number((qty * c.p.cost_price).toFixed(2));
    remaining = Number((remaining - lineCost).toFixed(2));
    const partialNote = qty < c.neededQty ? ` (budget-capped from ${c.neededQty} ideal units)` : '';

    const rec: ReorderRecommendation = {
      id: state.nextIds.reorder++,
      product_id: c.p.id,
      product_name: c.p.name,
      sku: c.p.sku,
      budget_allocated: budget,
      priority_rank: rank,
      priority_score: c.priorityScore,
      recommended_quantity: qty,
      unit_cost: c.p.cost_price,
      total_cost: lineCost,
      safety_stock_target: c.safetyStock,
      rationale: `${c.p.name} is ranked #${rank} (${c.risk.risk_level} risk) with ${c.p.current_stock} units on hand, avg demand ${c.avgDaily}/day, and ${c.leadTime}-day supplier lead time. Ordering ${qty} units restores safety stock target (${c.safetyStock} units)${partialNote}.`,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };
    state.reorders.push(rec);
    created.push(rec);
    rank++;
  }

  if (totalIdealCost > budget && candidates.some((c) => c.risk.risk_level === 'HIGH')) {
    upsertAlertInternal(
      state,
      'INSUFFICIENT_BUDGET',
      'MEDIUM',
      `Configured purchasing budget (${budget.toLocaleString('en-IN')}) covers only part of total replenishment need (${totalIdealCost.toLocaleString('en-IN')}). Prioritize top-ranked critical SKUs.`,
      'budget',
    );
  } else {
    resolveAlertsInternal(state, 'INSUFFICIENT_BUDGET');
  }

  const spent = Number(created.reduce((s, r) => s + r.total_cost, 0).toFixed(2));
  return {
    budget,
    total_allocated_cost: spent,
    remaining_budget: Number((budget - spent).toFixed(2)),
    budget_utilization_pct: budget > 0 ? Number(((spent / budget) * 100).toFixed(1)) : 0,
    total_ideal_cost: totalIdealCost,
    recommendations: created,
  };
}

function generateDiscountsInternal(
  state: PreviewState,
  minMarginPct: number,
  slowThresholdDays: number,
): DiscountRecommendation[] {
  const nowMs = Date.now();
  const sales30 = get30DaySalesMap(state);

  const lastSaleMap = new Map<number, number>();
  for (const s of state.sales) {
    const t = new Date(s.sale_date).getTime();
    for (const it of s.items) {
      const prev = lastSaleMap.get(it.product_id) ?? 0;
      if (t > prev) lastSaleMap.set(it.product_id, t);
    }
  }

  state.discounts = state.discounts.filter((d) => d.status !== 'PENDING');
  const created: DiscountRecommendation[] = [];

  for (const p of state.products) {
    if (p.current_stock <= 0) continue;
    const lastTs = lastSaleMap.get(p.id) ?? new Date(p.created_at).getTime();
    const daysSince = Math.max(0, Math.floor((nowMs - lastTs) / 86400_000));
    const stockAge = Math.max(daysSince, Math.floor((nowMs - new Date(p.created_at).getTime()) / 86400_000));
    const avg30 = (sales30.get(p.id) ?? 0) / 30;
    const daysSupply = avg30 > 0 ? p.current_stock / avg30 : 999;

    const isSlow = daysSince >= slowThresholdDays || (daysSupply >= 90 && p.current_stock >= Math.max(15, p.reorder_level));
    if (!isSlow) continue;

    const marginFrac = Math.min(0.8, Math.max(0, minMarginPct / 100));
    const minAllowedPrice = p.cost_price / (1 - marginFrac);
    if (minAllowedPrice >= p.selling_price) continue;

    const maxSafeDiscount = ((p.selling_price - minAllowedPrice) / p.selling_price) * 100;
    const desired = daysSince >= 45 ? 20 : daysSince >= 30 ? 15 : 10;
    const recPct = Number(Math.min(desired, maxSafeDiscount).toFixed(1));
    if (recPct < 3) continue;

    const newPrice = Math.max(
      Number((p.selling_price * (1 - recPct / 100)).toFixed(2)),
      Number(minAllowedPrice.toFixed(2)),
    );
    const profitPerUnit = Number((newPrice - p.cost_price).toFixed(2));
    const estClear = Math.min(p.current_stock, Math.max(5, Math.round(p.current_stock * 0.35)));

    const rec: DiscountRecommendation = {
      id: state.nextIds.discount++,
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      category: p.category,
      days_since_last_sale: daysSince,
      stock_age_days: stockAge,
      current_stock: p.current_stock,
      current_selling_price: p.selling_price,
      cost_price: p.cost_price,
      recommended_discount_pct: recPct,
      new_selling_price: newPrice,
      estimated_profit_per_unit: profitPerUnit,
      min_profit_margin_pct: minMarginPct,
      estimated_stock_clearing_impact: `Projected to clear ~${estClear} units (${Math.round((estClear / p.current_stock) * 100)}% of stagnant stock) within 30 days`,
      rationale: `${p.name} has had no sales for ${daysSince} days with ${p.current_stock} units in stock. A ${recPct}% markdown lowers price to ${newPrice.toFixed(2)} while preserving a ${((profitPerUnit / newPrice) * 100).toFixed(1)}% margin (above ${minMarginPct}% floor).`,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };
    state.discounts.push(rec);
    created.push(rec);

    upsertAlertInternal(
      state,
      'SLOW_MOVING_PRODUCT',
      'MEDIUM',
      `${p.name} is slow-moving (${daysSince} days since last sale, ${p.current_stock} units on hand).`,
      `slow:${p.id}`,
      p.id,
    );
  }

  return created;
}

function buildForecast(
  state: PreviewState,
  product: Product,
  horizonDays: number,
  modelPreference?: string,
): ForecastResult {
  // Aggregate daily sales series
  const byDate = new Map<string, number>();
  for (const s of state.sales) {
    const dStr = s.sale_date.slice(0, 10);
    for (const it of s.items) {
      if (it.product_id === product.id) {
        byDate.set(dStr, (byDate.get(dStr) ?? 0) + it.quantity);
      }
    }
  }

  const datesSorted = Array.from(byDate.keys()).sort();
  if (datesSorted.length === 0) {
    const today = new Date();
    return {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      current_stock: product.current_stock,
      horizon_days: horizonDays,
      model_name: 'Zero-History Fallback (Baseline)',
      predicted_total_demand: 0,
      predicted_daily_demand: 0,
      trend_direction: 'STABLE',
      mae: null,
      rmse: null,
      data_points_used: 0,
      sufficient_data: false,
      supports_intervals: false,
      data_requirements: 'Minimum 14 days of sales history required for accuracy evaluation and 30+ days for ML models.',
      explanation: `${product.name} currently has no recorded sales history. Zero demand is projected until initial sales transactions are logged.`,
      factors: ['Insufficient historical sales volume (0 units sold)'],
      model_comparisons: [],
      historical_series: [],
      forecast_series: Array.from({ length: horizonDays }, (_, i) => {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() + i + 1);
        return { date: d.toISOString().slice(0, 10), predicted: 0, lower_bound: null, upper_bound: null };
      }),
      validation_series: [],
    };
  }

  // Fill contiguous daily grid from first sale to today
  const start = new Date(datesSorted[0]);
  const end = new Date();
  const series: { date: string; actual: number }[] = [];
  for (let cur = new Date(start); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const iso = cur.toISOString().slice(0, 10);
    series.push({ date: iso, actual: byDate.get(iso) ?? 0 });
  }

  const values = series.map((s) => s.actual);
  const n = values.length;
  const firstWindow = values.slice(Math.max(0, n - 28), Math.max(1, n - 14));
  const secondWindow = values.slice(Math.max(0, n - 14));
  const avg1 = firstWindow.reduce((a, b) => a + b, 0) / Math.max(1, firstWindow.length);
  const avg2 = secondWindow.reduce((a, b) => a + b, 0) / Math.max(1, secondWindow.length);
  const pctChange = avg1 > 0.01 ? ((avg2 - avg1) / avg1) * 100 : avg2 > 0.25 ? 100 : 0;
  const trendDir: ForecastResult['trend_direction'] =
    pctChange >= 10 ? 'INCREASING' : pctChange <= -10 ? 'DECREASING' : 'STABLE';

  if (n < 14) {
    const avg = values.reduce((a, b) => a + b, 0) / n;
    const lastDate = new Date(series[n - 1].date);
    return {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      current_stock: product.current_stock,
      horizon_days: horizonDays,
      model_name: 'Moving Average Fallback',
      predicted_total_demand: Number((avg * horizonDays).toFixed(2)),
      predicted_daily_demand: Number(avg.toFixed(2)),
      trend_direction: trendDir,
      mae: null,
      rmse: null,
      data_points_used: n,
      sufficient_data: false,
      supports_intervals: false,
      data_requirements: 'At least 14 days of history needed for holdout MAE/RMSE validation; 30+ days for ML models.',
      explanation: `Only ${n} days of sales history exist for ${product.name}. Using an explainable ${n}-day moving average (${avg.toFixed(2)} units/day).`,
      factors: [`Limited history window (${n} days)`, `Recent average demand: ${avg.toFixed(2)} units/day`],
      model_comparisons: [],
      historical_series: series,
      forecast_series: Array.from({ length: horizonDays }, (_, i) => {
        const d = new Date(lastDate);
        d.setUTCDate(d.getUTCDate() + i + 1);
        return { date: d.toISOString().slice(0, 10), predicted: Number(avg.toFixed(2)), lower_bound: null, upper_bound: null };
      }),
      validation_series: [],
    };
  }

  const testSize = Math.min(14, Math.max(5, Math.floor(n / 5)));
  const train = values.slice(0, n - testSize);
  const test = values.slice(n - testSize);
  const trainSeries = series.slice(0, n - testSize);
  const testSeries = series.slice(n - testSize);

  const maPred = (arr: number[], steps: number) => {
    const w = arr.slice(-Math.min(7, arr.length));
    const avg = w.reduce((a, b) => a + b, 0) / w.length;
    return Array.from({ length: steps }, () => Math.max(0, avg));
  };

  const holtPred = (arr: number[], steps: number) => {
    let level = arr[0];
    let trend = arr.length > 1 ? arr[1] - arr[0] : 0;
    for (let i = 1; i < arr.length; i++) {
      const prev = level;
      level = 0.35 * arr[i] + 0.65 * (level + trend);
      trend = 0.12 * (level - prev) + 0.88 * trend;
    }
    return Array.from({ length: steps }, (_, h) => Math.max(0, level + (h + 1) * trend * 0.5));
  };

  const seasonalPred = (arr: number[], steps: number) => {
    const season = arr.slice(-7);
    return Array.from({ length: steps }, (_, i) => Math.max(0, season[i % 7]));
  };

  // Linear Trend + Weekly Seasonality Regression (OLS)
  const linearSeasonalPred = (arr: number[], startDateStr: string, steps: number) => {
    const m = arr.length;
    const tail = arr.slice(-Math.min(90, m));
    const k = tail.length;
    let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
    for (let i = 0; i < k; i++) {
      sumX += i;
      sumY += tail[i];
      sumXX += i * i;
      sumXY += i * tail[i];
    }
    const denom = k * sumXX - sumX * sumX || 1;
    const slope = (k * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / k;

    // Weekend ratio
    const baseDate = new Date(startDateStr);
    let wkndSum = 0, wkndCnt = 0, wkdySum = 0, wkdyCnt = 0;
    for (let i = 0; i < k; i++) {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() - (k - 1 - i));
      const dow = d.getUTCDay();
      if (dow === 0 || dow === 6) { wkndSum += tail[i]; wkndCnt++; }
      else { wkdySum += tail[i]; wkdyCnt++; }
    }
    const meanAll = sumY / k || 1;
    const wkndFactor = wkndCnt > 0 ? (wkndSum / wkndCnt) / meanAll : 1;
    const wkdyFactor = wkdyCnt > 0 ? (wkdySum / wkdyCnt) / meanAll : 1;

    return Array.from({ length: steps }, (_, h) => {
      const d = new Date(baseDate);
      d.setUTCDate(d.getUTCDate() + h + 1);
      const dow = d.getUTCDay();
      const basePred = Math.max(0, intercept + slope * (k + h));
      const factor = dow === 0 || dow === 6 ? wkndFactor : wkdyFactor;
      return Math.max(0, basePred * (0.5 + 0.5 * factor));
    });
  };

  const calcMetrics = (actuals: number[], preds: number[]) => {
    let absErr = 0;
    let sqErr = 0;
    for (let i = 0; i < actuals.length; i++) {
      const err = actuals[i] - preds[i];
      absErr += Math.abs(err);
      sqErr += err * err;
    }
    return {
      mae: Number((absErr / actuals.length).toFixed(3)),
      rmse: Number(Math.sqrt(sqErr / actuals.length).toFixed(3)),
    };
  };

  const candidates: Record<string, { valPreds: number[]; mae: number; rmse: number; intervals: boolean }> = {};

  const maVal = maPred(train, testSize);
  candidates['Moving Average (7D)'] = { valPreds: maVal, ...calcMetrics(test, maVal), intervals: true };

  const esVal = holtPred(train, testSize);
  candidates['Exponential Smoothing'] = { valPreds: esVal, ...calcMetrics(test, esVal), intervals: true };

  const snVal = seasonalPred(train, testSize);
  candidates['Seasonal Naive (Weekly)'] = { valPreds: snVal, ...calcMetrics(test, snVal), intervals: false };

  if (n >= 30) {
    const lrVal = linearSeasonalPred(train, trainSeries[trainSeries.length - 1].date, testSize);
    candidates['Trend + Seasonal ML'] = { valPreds: lrVal, ...calcMetrics(test, lrVal), intervals: true };
  }

  const selectedName =
    modelPreference && candidates[modelPreference]
      ? modelPreference
      : Object.keys(candidates).sort((a, b) => candidates[a].rmse - candidates[b].rmse)[0];

  const chosen = candidates[selectedName];
  const lastDateStr = series[n - 1].date;
  let futurePreds: number[];
  if (selectedName === 'Moving Average (7D)') futurePreds = maPred(values, horizonDays);
  else if (selectedName === 'Exponential Smoothing') futurePreds = holtPred(values, horizonDays);
  else if (selectedName === 'Seasonal Naive (Weekly)') futurePreds = seasonalPred(values, horizonDays);
  else futurePreds = linearSeasonalPred(values, lastDateStr, horizonDays);

  const residuals = test.map((v, i) => v - chosen.valPreds[i]);
  const resMean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const resStd = Math.sqrt(residuals.reduce((a, b) => a + (b - resMean) ** 2, 0) / residuals.length);

  const lastDate = new Date(lastDateStr);
  const forecastSeries = futurePreds.map((val, i) => {
    const d = new Date(lastDate);
    d.setUTCDate(d.getUTCDate() + i + 1);
    const margin = 1.645 * resStd * Math.sqrt(1 + i * 0.05);
    return {
      date: d.toISOString().slice(0, 10),
      predicted: Number(val.toFixed(2)),
      lower_bound: chosen.intervals ? Number(Math.max(0, val - margin).toFixed(2)) : null,
      upper_bound: chosen.intervals ? Number((val + margin).toFixed(2)) : null,
    };
  });

  const predTotal = Number(futurePreds.reduce((a, b) => a + b, 0).toFixed(2));
  const predDaily = Number((predTotal / horizonDays).toFixed(2));
  const avg30 = values.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, values.length);

  return {
    product_id: product.id,
    product_name: product.name,
    sku: product.sku,
    current_stock: product.current_stock,
    horizon_days: horizonDays,
    model_name: selectedName,
    predicted_total_demand: predTotal,
    predicted_daily_demand: predDaily,
    trend_direction: trendDir,
    mae: chosen.mae,
    rmse: chosen.rmse,
    data_points_used: n,
    sufficient_data: true,
    supports_intervals: chosen.intervals,
    data_requirements: `Validated on ${n} days (${testSize}-day holdout split).`,
    explanation: `${selectedName} achieved the lowest holdout error (MAE ${chosen.mae.toFixed(2)}, RMSE ${chosen.rmse.toFixed(2)}) on ${product.name} across ${n} days of sales data. Demand is ${trendDir.toLowerCase()} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}%), projecting ${Math.round(predTotal)} total units (${predDaily.toFixed(2)}/day) over the next ${horizonDays} days.`,
    factors: [
      `Recent 14-day demand trajectory: ${trendDir} (${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% vs prior period)`,
      `30-day historical daily average: ${avg30.toFixed(2)} units/day`,
      `Evaluated across ${n} historical days with ${testSize}-day out-of-sample backtest`,
    ],
    model_comparisons: Object.entries(candidates)
      .sort((a, b) => a[1].rmse - b[1].rmse)
      .map(([name, m]) => ({
        model_name: name,
        mae: m.mae,
        rmse: m.rmse,
        selected: name === selectedName,
      })),
    historical_series: series.slice(-90),
    forecast_series: forecastSeries,
    validation_series: testSeries.map((t, i) => ({
      date: t.date,
      actual: t.actual,
      predicted: Number(chosen.valPreds[i].toFixed(2)),
    })),
  };
}

export const previewEngine = {
  login(email: string, _password: string) {
    const state = loadState();
    const user = { ...state.user, email: email || state.user.email };
    state.user = user;
    saveState(state);
    return { access_token: 'preview-jwt-session', user };
  },
  register(payload: { email: string; full_name: string; business_name: string; currency?: string }) {
    const state = loadState();
    state.user = {
      ...state.user,
      email: payload.email,
      full_name: payload.full_name,
      business_name: payload.business_name,
      currency: payload.currency ?? 'INR',
    };
    saveState(state);
    return { access_token: 'preview-jwt-session', user: state.user };
  },
  getMe() {
    return loadState().user;
  },
  updateMe(payload: Partial<User>) {
    const state = loadState();
    state.user = { ...state.user, ...payload };
    saveState(state);
    return state.user;
  },

  // Products
  listProducts(params?: { search?: string; category?: string; stock_status?: string; sort_by?: string; sort_order?: string }) {
    const state = loadState();
    let list = [...state.products];
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (params?.category && params.category !== 'ALL') {
      list = list.filter((p) => p.category === params.category);
    }
    if (params?.stock_status && params.stock_status !== 'ALL') {
      list = list.filter((p) => p.stock_status === params.stock_status);
    }
    const sortBy = (params?.sort_by ?? 'updated_at') as keyof Product;
    const asc = params?.sort_order === 'asc';
    list.sort((a, b) => {
      const va = a[sortBy] ?? '';
      const vb = b[sortBy] ?? '';
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    const categories = Array.from(new Set(state.products.map((p) => p.category))).sort();
    return { items: list, total: list.length, page: 1, page_size: 200, categories };
  },
  createProduct(payload: Omit<Product, 'id' | 'stock_status' | 'is_demo' | 'created_at' | 'updated_at'>) {
    const state = loadState();
    if (state.products.some((p) => p.sku.toLowerCase() === payload.sku.toLowerCase())) {
      throw new Error(`SKU '${payload.sku}' already exists`);
    }
    if (payload.selling_price < payload.cost_price) {
      throw new Error('Selling price must be greater than or equal to cost price');
    }
    const sup = state.suppliers.find((s) => s.id === payload.supplier_id);
    const nowIso = new Date().toISOString();
    const product: Product = {
      ...payload,
      id: state.nextIds.product++,
      supplier_name: sup?.name ?? null,
      stock_status: payload.current_stock === 0 ? 'OUT_OF_STOCK' : payload.current_stock <= payload.minimum_stock ? 'LOW_STOCK' : 'IN_STOCK',
      is_demo: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
    state.products.unshift(product);
    syncAlerts(state);
    saveState(state);
    return product;
  },
  updateProduct(id: number, payload: Partial<Product>) {
    const state = loadState();
    const idx = state.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Product not found');
    const current = state.products[idx];
    const sup = payload.supplier_id !== undefined ? state.suppliers.find((s) => s.id === payload.supplier_id) : undefined;
    const updated: Product = {
      ...current,
      ...payload,
      supplier_name: payload.supplier_id !== undefined ? sup?.name ?? null : current.supplier_name,
      updated_at: new Date().toISOString(),
    };
    if (updated.selling_price < updated.cost_price) {
      throw new Error('Selling price cannot be less than cost price');
    }
    updated.stock_status = computeStockStatus(updated);
    state.products[idx] = updated;
    syncAlerts(state);
    saveState(state);
    return updated;
  },
  deleteProduct(id: number) {
    const state = loadState();
    state.products = state.products.filter((p) => p.id !== id);
    syncAlerts(state);
    saveState(state);
  },

  // Suppliers
  listSuppliers(search?: string) {
    const state = loadState();
    if (!search) return state.suppliers;
    const q = search.toLowerCase();
    return state.suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.contact_person.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  },
  createSupplier(payload: Omit<Supplier, 'id' | 'is_demo' | 'created_at' | 'updated_at'>) {
    const state = loadState();
    if (state.suppliers.some((s) => s.name.toLowerCase() === payload.name.toLowerCase())) {
      throw new Error(`Supplier '${payload.name}' already exists`);
    }
    const nowIso = new Date().toISOString();
    const sup: Supplier = {
      ...payload,
      id: state.nextIds.supplier++,
      is_demo: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
    state.suppliers.push(sup);
    saveState(state);
    return sup;
  },
  updateSupplier(id: number, payload: Partial<Supplier>) {
    const state = loadState();
    const idx = state.suppliers.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Supplier not found');
    state.suppliers[idx] = { ...state.suppliers[idx], ...payload, updated_at: new Date().toISOString() };
    saveState(state);
    return state.suppliers[idx];
  },
  deleteSupplier(id: number) {
    const state = loadState();
    state.suppliers = state.suppliers.filter((s) => s.id !== id);
    saveState(state);
  },
  getSupplierDeliveries(supplierId: number) {
    return loadState().deliveries.filter((d) => d.supplier_id === supplierId);
  },
  logSupplierDelivery(payload: { supplier_id: number; po_reference: string; expected_delivery_date: string; actual_delivery_date?: string }) {
    const state = loadState();
    let delay = 0;
    let status: SupplierDelivery['delivery_status'] = 'PENDING';
    if (payload.actual_delivery_date) {
      const diffMs = new Date(payload.actual_delivery_date).getTime() - new Date(payload.expected_delivery_date).getTime();
      delay = Math.max(0, Math.round(diffMs / 86400_000));
      status = delay > 0 ? 'DELAYED' : 'ON_TIME';
    }
    const d: SupplierDelivery = {
      id: state.nextIds.delivery++,
      supplier_id: payload.supplier_id,
      po_reference: payload.po_reference,
      expected_delivery_date: payload.expected_delivery_date,
      actual_delivery_date: payload.actual_delivery_date ?? null,
      delay_days: delay,
      delivery_status: status,
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    state.deliveries.unshift(d);
    syncAlerts(state);
    saveState(state);
    return d;
  },
  getSupplierRisks() {
    const state = loadState();
    return { items: computeSupplierRisks(state) };
  },

  // Inventory
  getInventory() {
    const state = loadState();
    const items = state.products.map((p) => ({
      product_id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      current_stock: p.current_stock,
      minimum_stock: p.minimum_stock,
      reorder_level: p.reorder_level,
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      inventory_value: Number((p.cost_price * p.current_stock).toFixed(2)),
      stock_status: p.stock_status,
      updated_at: p.updated_at,
    }));
    return {
      summary: {
        total_skus: items.length,
        total_units: items.reduce((s, i) => s + i.current_stock, 0),
        total_cost_valuation: Number(items.reduce((s, i) => s + i.inventory_value, 0).toFixed(2)),
        total_retail_valuation: Number(items.reduce((s, i) => s + i.selling_price * i.current_stock, 0).toFixed(2)),
        low_stock_count: items.filter((i) => i.stock_status === 'LOW_STOCK').length,
        out_of_stock_count: items.filter((i) => i.stock_status === 'OUT_OF_STOCK').length,
      },
      items,
    };
  },
  createMovement(payload: { product_id: number; movement_type: 'ADDITION' | 'REDUCTION' | 'ADJUSTMENT'; quantity: number; reason: string }) {
    const state = loadState();
    const p = state.products.find((x) => x.id === payload.product_id);
    if (!p) throw new Error('Product not found');
    const prev = p.current_stock;
    let next = prev;
    if (payload.movement_type === 'ADDITION') {
      if (payload.quantity <= 0) throw new Error('Addition quantity must be greater than zero');
      next = prev + payload.quantity;
    } else if (payload.movement_type === 'REDUCTION') {
      if (payload.quantity <= 0) throw new Error('Reduction quantity must be greater than zero');
      next = prev - payload.quantity;
      if (next < 0) throw new Error(`Insufficient stock for ${p.name}: available ${prev}, requested ${payload.quantity}`);
    } else {
      if (payload.quantity < 0) throw new Error('Adjusted stock cannot be negative');
      next = payload.quantity;
    }
    p.current_stock = next;
    p.stock_status = computeStockStatus(p);
    p.updated_at = new Date().toISOString();

    const mv: InventoryMovement = {
      id: state.nextIds.movement++,
      product_id: p.id,
      product_name: p.name,
      sku: p.sku,
      movement_type: payload.movement_type,
      quantity: payload.quantity,
      previous_quantity: prev,
      new_quantity: next,
      reason: payload.reason,
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    state.movements.unshift(mv);
    syncAlerts(state);
    saveState(state);
    return mv;
  },
  listMovements(params?: { product_id?: number; movement_type?: string }) {
    let items = loadState().movements;
    if (params?.product_id) items = items.filter((m) => m.product_id === params.product_id);
    if (params?.movement_type && params.movement_type !== 'ALL') {
      items = items.filter((m) => m.movement_type === params.movement_type);
    }
    return { items: items.slice(0, 120) };
  },

  // Sales
  listSales(params?: { product_id?: number; period?: string; start_date?: string; end_date?: string }) {
    let items = loadState().sales;
    const now = Date.now();
    if (params?.period === 'daily') items = items.filter((s) => new Date(s.sale_date).getTime() >= now - 86400_000);
    if (params?.period === 'weekly') items = items.filter((s) => new Date(s.sale_date).getTime() >= now - 7 * 86400_000);
    if (params?.period === 'monthly') items = items.filter((s) => new Date(s.sale_date).getTime() >= now - 30 * 86400_000);
    if (params?.start_date) items = items.filter((s) => s.sale_date.slice(0, 10) >= params.start_date!);
    if (params?.end_date) items = items.filter((s) => s.sale_date.slice(0, 10) <= params.end_date!);
    if (params?.product_id) items = items.filter((s) => s.items.some((it) => it.product_id === params.product_id));
    const totalRevenue = Number(items.reduce((s, x) => s + x.total_amount, 0).toFixed(2));
    return { items: items.slice(0, 120), summary: { count: items.length, total_revenue: totalRevenue } };
  },
  createSale(payload: { items: { product_id: number; quantity: number }[]; notes?: string }) {
    const state = loadState();
    const merged = new Map<number, number>();
    for (const it of payload.items) {
      merged.set(it.product_id, (merged.get(it.product_id) ?? 0) + it.quantity);
    }
    // Validate availability first (atomic rollback semantics)
    const entries: Array<{ p: Product; qty: number; lineTotal: number; prev: number }> = [];
    let subtotal = 0;
    for (const [pid, qty] of merged.entries()) {
      const p = state.products.find((x) => x.id === pid);
      if (!p) throw new Error(`Product ID ${pid} not found`);
      if (qty <= 0) throw new Error('Sale quantity must be greater than zero');
      if (p.current_stock < qty) {
        throw new Error(`Insufficient stock for ${p.name}: available ${p.current_stock}, requested ${qty}`);
      }
      const lineTotal = Number((p.selling_price * qty).toFixed(2));
      subtotal += lineTotal;
      entries.push({ p, qty, lineTotal, prev: p.current_stock });
    }

    const nowIso = new Date().toISOString();
    const ref = `SAL-${nowIso.slice(0, 10).replace(/-/g, '')}-${String(state.nextIds.sale).padStart(4, '0')}`;
    const saleItems: Sale['items'] = [];

    for (const e of entries) {
      e.p.current_stock = e.prev - e.qty;
      e.p.stock_status = computeStockStatus(e.p);
      e.p.updated_at = nowIso;

      saleItems.push({
        id: state.nextIds.saleItem++,
        product_id: e.p.id,
        product_name: e.p.name,
        sku: e.p.sku,
        quantity: e.qty,
        unit_price: e.p.selling_price,
        line_total: e.lineTotal,
      });

      state.movements.unshift({
        id: state.nextIds.movement++,
        product_id: e.p.id,
        product_name: e.p.name,
        sku: e.p.sku,
        movement_type: 'SALE',
        quantity: e.qty,
        previous_quantity: e.prev,
        new_quantity: e.p.current_stock,
        reason: `Sale transaction ${ref}`,
        is_demo: false,
        created_at: nowIso,
      });
    }

    const sale: Sale = {
      id: state.nextIds.sale++,
      reference_number: ref,
      subtotal: Number(subtotal.toFixed(2)),
      total_amount: Number(subtotal.toFixed(2)),
      notes: payload.notes ?? null,
      sale_date: nowIso,
      is_demo: false,
      items: saleItems,
    };
    state.sales.unshift(sale);
    syncAlerts(state);
    saveState(state);
    return sale;
  },

  // Forecasting & Risks
  getForecast(productId: number, horizonDays: number, modelPreference?: string) {
    const state = loadState();
    const p = state.products.find((x) => x.id === productId);
    if (!p) throw new Error('Product not found');
    return buildForecast(state, p, horizonDays, modelPreference);
  },
  getRisks(riskLevel?: string) {
    let items = computeRisks(loadState());
    if (riskLevel && riskLevel !== 'ALL') items = items.filter((r) => r.risk_level === riskLevel);
    return { items };
  },

  // Recommendations
  generateReorder(budget: number) {
    const state = loadState();
    const res = generateReordersInternal(state, budget);
    saveState(state);
    return res;
  },
  generateDiscounts(minProfitMarginPct?: number, slowThresholdDays = 21) {
    const state = loadState();
    const margin = minProfitMarginPct ?? state.user.min_profit_margin_pct;
    const items = generateDiscountsInternal(state, margin, slowThresholdDays);
    saveState(state);
    return { items };
  },
  listRecommendations() {
    const state = loadState();
    return { reorders: state.reorders, discounts: state.discounts };
  },
  updateReorderStatus(id: number, status: 'ACCEPTED' | 'REJECTED') {
    const state = loadState();
    const rec = state.reorders.find((r) => r.id === id);
    if (!rec) throw new Error('Recommendation not found');
    rec.status = status;
    saveState(state);
    return { id: rec.id, status: rec.status };
  },
  updateDiscountStatus(id: number, status: 'ACCEPTED' | 'REJECTED') {
    const state = loadState();
    const rec = state.discounts.find((d) => d.id === id);
    if (!rec) throw new Error('Discount recommendation not found');
    rec.status = status;
    if (status === 'ACCEPTED') {
      const p = state.products.find((x) => x.id === rec.product_id);
      if (p) {
        p.selling_price = rec.new_selling_price;
        p.updated_at = new Date().toISOString();
      }
    }
    saveState(state);
    return { id: rec.id, status: rec.status };
  },

  // Decision Center
  getDecisions() {
    const state = loadState();
    const risks = computeRisks(state);
    const supRisks = computeSupplierRisks(state);
    const reorderByPid = new Map(state.reorders.filter((r) => r.status === 'PENDING').map((r) => [r.product_id, r]));
    const insights: DecisionInsight[] = [];

    for (const r of risks) {
      if (r.risk_level === 'LOW') continue;
      const p = state.products.find((x) => x.id === r.product_id);
      if (!p) continue;
      const fc = buildForecast(state, p, 30);
      const reorder = reorderByPid.get(p.id);
      const estRevLoss = Math.round(p.selling_price * Math.max(1, r.avg_daily_demand * Math.max(1, r.supplier_lead_time_days)));

      insights.push({
        id: `risk-${p.id}`,
        entity_type: 'PRODUCT',
        entity_id: p.id,
        entity_name: p.name,
        priority: r.risk_level,
        what_is_happening: `${p.name} requires ${r.risk_level === 'HIGH' ? 'immediate' : 'proactive'} attention: only ${r.available_stock} units remain (${r.days_remaining ?? 'N/A'} days of stock).`,
        why_it_happens: `Recent demand is ${fc.trend_direction.toLowerCase()} (${r.avg_daily_demand}/day) while supplier lead time is ${r.supplier_lead_time_days} days.`,
        business_impact: `Risk of stockout by ${r.expected_stockout_date ?? 'near term'}, threatening ~${estRevLoss.toLocaleString('en-IN')} in sales revenue.`,
        recommended_action: reorder
          ? `Approve purchase order for ${reorder.recommended_quantity} units (cost ${reorder.total_cost.toLocaleString('en-IN')}).`
          : r.recommended_action,
        metrics: {
          current_stock: r.available_stock,
          avg_daily_demand: r.avg_daily_demand,
          days_remaining: r.days_remaining,
          trend: fc.trend_direction,
        },
      });
    }

    for (const sr of supRisks) {
      if (sr.risk_level !== 'HIGH' && sr.risk_level !== 'MEDIUM') continue;
      insights.push({
        id: `supplier-${sr.supplier_id}`,
        entity_type: 'SUPPLIER',
        entity_id: sr.supplier_id,
        entity_name: sr.supplier_name,
        priority: sr.risk_level,
        what_is_happening: `${sr.supplier_name} is showing a ${sr.delay_percentage.toFixed(0)}% late delivery rate across ${sr.total_deliveries} completed orders.`,
        why_it_happens: `${sr.delayed_deliveries} of ${sr.total_deliveries} deliveries arrived past expected dates, raising effective lead time to ${sr.avg_delivery_time_days} days.`,
        business_impact: `Affects ${sr.linked_products} linked SKUs and increases stockout exposure during replenishment.`,
        recommended_action: 'Increase safety stock targets on linked SKUs or split orders with a reliable secondary supplier.',
        metrics: {
          delay_percentage: sr.delay_percentage,
          avg_delivery_time_days: sr.avg_delivery_time_days,
          linked_products: sr.linked_products,
        },
      });
    }

    for (const d of state.discounts.filter((x) => x.status === 'PENDING').slice(0, 6)) {
      const p = state.products.find((x) => x.id === d.product_id);
      if (!p) continue;
      const tied = Math.round(p.cost_price * d.current_stock);
      insights.push({
        id: `discount-${p.id}`,
        entity_type: 'PRODUCT',
        entity_id: p.id,
        entity_name: p.name,
        priority: 'MEDIUM',
        what_is_happening: `${p.name} has stagnant inventory (${d.current_stock} units) with ${d.days_since_last_sale} days since last sale.`,
        why_it_happens: 'Recent sell-through stalled below holding capacity, tying up warehouse space and working capital.',
        business_impact: `${tied.toLocaleString('en-IN')} in inventory cost is immobilized with rising shelf-age risk.`,
        recommended_action: `Apply a ${d.recommended_discount_pct}% discount (new price ${d.new_selling_price.toFixed(2)}) while preserving ${d.estimated_profit_per_unit.toFixed(2)}/unit profit.`,
        metrics: {
          days_since_last_sale: d.days_since_last_sale,
          recommended_discount_pct: d.recommended_discount_pct,
          tied_capital: tied,
        },
      });
    }

    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    insights.sort((a, b) => order[a.priority] - order[b.priority]);
    return { items: insights };
  },

  // Alerts
  listAlerts(params?: { severity?: string; category?: string; unread_only?: boolean }) {
    const state = loadState();
    let items = state.alerts.filter((a) => !a.is_resolved);
    if (params?.severity && params.severity !== 'ALL') items = items.filter((a) => a.severity === params.severity);
    if (params?.category && params.category !== 'ALL') items = items.filter((a) => a.category === params.category);
    if (params?.unread_only) items = items.filter((a) => !a.is_read);
    const unreadCount = state.alerts.filter((a) => !a.is_resolved && !a.is_read).length;
    return { items, unread_count: unreadCount };
  },
  markAlertRead(id: number) {
    const state = loadState();
    const a = state.alerts.find((x) => x.id === id);
    if (a) a.is_read = true;
    saveState(state);
    return { id, is_read: true };
  },
  markAllAlertsRead() {
    const state = loadState();
    state.alerts.forEach((a) => { a.is_read = true; });
    saveState(state);
    return { status: 'ok' };
  },

  // Dashboard & Analytics
  getDashboardSummary(): DashboardSummary {
    const state = loadState();
    const risks = computeRisks(state);
    const supRisks = computeSupplierRisks(state);
    const cutoff30 = Date.now() - 30 * 86400_000;

    const totalRevenue = Number(state.sales.reduce((s, x) => s + x.total_amount, 0).toFixed(2));
    const monthlyRevenue = Number(
      state.sales
        .filter((s) => new Date(s.sale_date).getTime() >= cutoff30)
        .reduce((s, x) => s + x.total_amount, 0)
        .toFixed(2),
    );

    return {
      kpis: {
        total_products: state.products.length,
        total_inventory_value: Number(
          state.products.reduce((s, p) => s + p.cost_price * p.current_stock, 0).toFixed(2),
        ),
        total_sales: state.sales.length,
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        low_stock_products: state.products.filter((p) => p.current_stock <= p.minimum_stock).length,
        high_risk_products: risks.filter((r) => r.risk_level === 'HIGH').length,
        pending_reorders: state.reorders.filter((r) => r.status === 'PENDING').length,
        supplier_risk_count: supRisks.filter((s) => s.risk_level === 'HIGH' || s.risk_level === 'MEDIUM').length,
      },
      recent_transactions: state.sales.slice(0, 6).map((s) => ({
        id: s.id,
        reference_number: s.reference_number,
        total_amount: s.total_amount,
        sale_date: s.sale_date,
        item_count: s.items.length,
      })),
      critical_alerts: state.alerts
        .filter((a) => !a.is_resolved)
        .slice(0, 6)
        .map((a) => ({
          id: a.id,
          category: a.category,
          severity: a.severity,
          message: a.message,
          is_read: a.is_read,
          created_at: a.created_at,
        })),
      top_recommendations: state.reorders
        .filter((r) => r.status === 'PENDING')
        .slice(0, 5)
        .map((r) => ({
          id: r.id,
          product_id: r.product_id,
          product_name: r.product_name,
          recommended_quantity: r.recommended_quantity,
          total_cost: r.total_cost,
          priority_rank: r.priority_rank,
          rationale: r.rationale,
        })),
      inventory_summary: {
        in_stock: state.products.filter((p) => p.current_stock > p.minimum_stock).length,
        low_stock: state.products.filter((p) => p.current_stock > 0 && p.current_stock <= p.minimum_stock).length,
        out_of_stock: state.products.filter((p) => p.current_stock === 0).length,
      },
    };
  },

  getSalesAnalytics(): SalesAnalytics {
    const state = loadState();
    const nowMs = Date.now();
    const cutoff30 = nowMs - 30 * 86400_000;
    const dailyMap = new Map<string, { date: string; revenue: number; units: number }>();
    const monthlyMap = new Map<string, { month: string; revenue: number; orders: number }>();

    const prodUnits30 = new Map<number, number>();
    const prodRev30 = new Map<number, number>();
    const prodLastSale = new Map<number, number>();

    for (const s of state.sales) {
      const ts = new Date(s.sale_date).getTime();
      const dayKey = s.sale_date.slice(0, 10);
      const monthKey = s.sale_date.slice(0, 7);

      const m = monthlyMap.get(monthKey) ?? { month: monthKey, revenue: 0, orders: 0 };
      m.revenue = Number((m.revenue + s.total_amount).toFixed(2));
      m.orders += 1;
      monthlyMap.set(monthKey, m);

      const saleUnits = s.items.reduce((acc, it) => acc + it.quantity, 0);
      if (ts >= cutoff30) {
        const d = dailyMap.get(dayKey) ?? { date: dayKey, revenue: 0, units: 0 };
        d.revenue = Number((d.revenue + s.total_amount).toFixed(2));
        d.units += saleUnits;
        dailyMap.set(dayKey, d);
      }

      for (const it of s.items) {
        const prevTs = prodLastSale.get(it.product_id) ?? 0;
        if (ts > prevTs) prodLastSale.set(it.product_id, ts);
        if (ts >= cutoff30) {
          prodUnits30.set(it.product_id, (prodUnits30.get(it.product_id) ?? 0) + it.quantity);
          prodRev30.set(it.product_id, Number(((prodRev30.get(it.product_id) ?? 0) + it.line_total).toFixed(2)));
        }
      }
    }

    const stats = state.products.map((p) => {
      const lastTs = prodLastSale.get(p.id);
      const daysSince = lastTs ? Math.floor((nowMs - lastTs) / 86400_000) : 999;
      return {
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        units_30d: prodUnits30.get(p.id) ?? 0,
        revenue_30d: prodRev30.get(p.id) ?? 0,
        current_stock: p.current_stock,
        days_since_last_sale: daysSince,
      };
    });

    const topSelling = [...stats].sort((a, b) => b.units_30d - a.units_30d).slice(0, 8);
    const slowMoving = [...stats].sort((a, b) => a.units_30d - b.units_30d || b.days_since_last_sale - a.days_since_last_sale).slice(0, 8);

    const leadProd = state.products.find((p) => p.id === topSelling[0]?.product_id) ?? state.products[0];
    const actualVsPred = leadProd ? buildForecast(state, leadProd, 14).validation_series : [];

    return {
      daily_sales_trend: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      monthly_revenue: Array.from(monthlyMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
      top_selling_products: topSelling,
      slow_moving_products: slowMoving,
      actual_vs_predicted: actualVsPred,
    };
  },

  getInventoryAnalytics(): InventoryAnalytics {
    const state = loadState();
    const risks = computeRisks(state);
    const supRisks = computeSupplierRisks(state);

    const catMap = new Map<string, { category: string; units: number; value: number; sku_count: number }>();
    for (const p of state.products) {
      const c = catMap.get(p.category) ?? { category: p.category, units: 0, value: 0, sku_count: 0 };
      c.units += p.current_stock;
      c.value = Number((c.value + p.cost_price * p.current_stock).toFixed(2));
      c.sku_count += 1;
      catMap.set(p.category, c);
    }

    const dist = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    risks.forEach((r) => { dist[r.risk_level] += 1; });

    return {
      inventory_by_category: Array.from(catMap.values()),
      stockout_risk_distribution: Object.entries(dist).map(([risk_level, count]) => ({ risk_level, count })),
      supplier_performance: supRisks.map((s) => ({
        supplier_name: s.supplier_name,
        on_time_deliveries: s.on_time_deliveries,
        delayed_deliveries: s.delayed_deliveries,
        delay_percentage: s.delay_percentage,
        risk_level: s.risk_level,
      })),
    };
  },

  resetDemoData() {
    const fresh = createSeedState();
    saveState(fresh);
    return fresh.user;
  },
};
