export interface User {
  id: number;
  email: string;
  full_name: string;
  business_name: string;
  role: string;
  currency: string;
  default_budget: number;
  min_profit_margin_pct: number;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  description?: string | null;
  selling_price: number;
  cost_price: number;
  current_stock: number;
  minimum_stock: number;
  reorder_level: number;
  supplier_id?: number | null;
  supplier_name?: string | null;
  stock_status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address?: string | null;
  avg_lead_time_days: number;
  reliability_status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierDelivery {
  id: number;
  supplier_id: number;
  po_reference: string;
  expected_delivery_date: string;
  actual_delivery_date?: string | null;
  delay_days: number;
  delivery_status: 'ON_TIME' | 'DELAYED' | 'PENDING';
  is_demo: boolean;
  created_at: string;
}

export interface SupplierRisk {
  supplier_id: number;
  supplier_name: string;
  contact_person: string;
  email: string;
  avg_lead_time_days: number;
  total_deliveries: number;
  on_time_deliveries: number;
  delayed_deliveries: number;
  avg_delivery_time_days: number;
  delay_percentage: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
  insufficient_records: boolean;
  linked_products: number;
  assessment: string;
}

export interface InventoryItem {
  product_id: number;
  name: string;
  sku: string;
  category: string;
  current_stock: number;
  minimum_stock: number;
  reorder_level: number;
  cost_price: number;
  selling_price: number;
  inventory_value: number;
  stock_status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  updated_at: string;
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  movement_type: 'ADDITION' | 'REDUCTION' | 'ADJUSTMENT' | 'SALE';
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reason: string;
  is_demo: boolean;
  created_at: string;
}

export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Sale {
  id: number;
  reference_number: string;
  subtotal: number;
  total_amount: number;
  notes?: string | null;
  sale_date: string;
  is_demo: boolean;
  items: SaleItem[];
}

export interface ForecastResult {
  product_id: number;
  product_name: string;
  sku: string;
  current_stock: number;
  horizon_days: number;
  model_name: string;
  predicted_total_demand: number;
  predicted_daily_demand: number;
  trend_direction: 'INCREASING' | 'DECREASING' | 'STABLE';
  mae: number | null;
  rmse: number | null;
  data_points_used: number;
  sufficient_data: boolean;
  supports_intervals: boolean;
  data_requirements: string;
  explanation: string;
  factors: string[];
  model_comparisons: {
    model_name: string;
    mae: number;
    rmse: number;
    selected: boolean;
  }[];
  historical_series: { date: string; actual: number }[];
  forecast_series: {
    date: string;
    predicted: number;
    lower_bound: number | null;
    upper_bound: number | null;
  }[];
  validation_series: { date: string; actual: number; predicted: number }[];
}

export interface InventoryRisk {
  id?: number;
  product_id: number;
  product_name: string;
  sku: string;
  category: string;
  available_stock: number;
  avg_daily_demand: number;
  predicted_daily_demand: number;
  days_remaining: number | null;
  expected_stockout_date: string | null;
  supplier_lead_time_days: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  recommended_action: string;
  calculated_at: string;
}

export interface ReorderRecommendation {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  budget_allocated?: number;
  priority_rank: number;
  priority_score: number;
  recommended_quantity: number;
  unit_cost: number;
  total_cost: number;
  safety_stock_target: number;
  rationale: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

export interface ReorderPlanResponse {
  budget: number;
  total_allocated_cost: number;
  remaining_budget: number;
  budget_utilization_pct: number;
  total_ideal_cost: number;
  recommendations: ReorderRecommendation[];
}

export interface DiscountRecommendation {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  category?: string;
  days_since_last_sale: number;
  stock_age_days: number;
  current_stock: number;
  current_selling_price: number;
  cost_price: number;
  recommended_discount_pct: number;
  new_selling_price: number;
  estimated_profit_per_unit: number;
  min_profit_margin_pct: number;
  estimated_stock_clearing_impact: string;
  rationale: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

export interface DecisionInsight {
  id: string;
  entity_type: 'PRODUCT' | 'SUPPLIER';
  entity_id: number;
  entity_name: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  what_is_happening: string;
  why_it_happens: string;
  business_impact: string;
  recommended_action: string;
  ai_narrative?: string | null;
  metrics: Record<string, string | number | null>;
}

export interface AlertItem {
  id: number;
  category: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  related_product_id?: number | null;
  related_supplier_id?: number | null;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
}

export interface DashboardSummary {
  kpis: {
    total_products: number;
    total_inventory_value: number;
    total_sales: number;
    total_revenue: number;
    monthly_revenue: number;
    low_stock_products: number;
    high_risk_products: number;
    pending_reorders: number;
    supplier_risk_count: number;
  };
  recent_transactions: {
    id: number;
    reference_number: string;
    total_amount: number;
    sale_date: string;
    item_count: number;
  }[];
  critical_alerts: {
    id: number;
    category: string;
    severity: string;
    message: string;
    is_read: boolean;
    created_at: string;
  }[];
  top_recommendations: {
    id: number;
    product_id: number;
    product_name: string;
    recommended_quantity: number;
    total_cost: number;
    priority_rank: number;
    rationale: string;
  }[];
  inventory_summary: {
    in_stock: number;
    low_stock: number;
    out_of_stock: number;
  };
}

export interface SalesAnalytics {
  daily_sales_trend: { date: string; revenue: number; units: number }[];
  monthly_revenue: { month: string; revenue: number; orders: number }[];
  top_selling_products: {
    product_id: number;
    name: string;
    sku: string;
    category: string;
    units_30d: number;
    revenue_30d: number;
    current_stock: number;
    days_since_last_sale: number;
  }[];
  slow_moving_products: {
    product_id: number;
    name: string;
    sku: string;
    category: string;
    units_30d: number;
    revenue_30d: number;
    current_stock: number;
    days_since_last_sale: number;
  }[];
  actual_vs_predicted: { date: string; actual: number; predicted: number }[];
}

export interface InventoryAnalytics {
  inventory_by_category: { category: string; units: number; value: number; sku_count: number }[];
  stockout_risk_distribution: { risk_level: string; count: number }[];
  supplier_performance: {
    supplier_name: string;
    on_time_deliveries: number;
    delayed_deliveries: number;
    delay_percentage: number;
    risk_level: string;
  }[];
}
