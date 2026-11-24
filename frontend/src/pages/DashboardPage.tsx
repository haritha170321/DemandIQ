import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  KpiCard,
  LoadingSkeleton,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { DashboardSummary, InventoryAnalytics, SalesAnalytics } from '../types';
import { formatCurrency, formatDateTime, formatNumber, getErrorMessage } from '../utils/format';

const RISK_COLORS: Record<string, string> = {
  HIGH: '#DC2626',
  MEDIUM: '#F59E0B',
  LOW: '#16A34A',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [invAnalytics, setInvAnalytics] = useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, salesRes, invRes] = await Promise.all([
        demandIqApi.getDashboardSummary(),
        demandIqApi.getSalesAnalytics(),
        demandIqApi.getInventoryAnalytics(),
      ]);
      setSummary(sumRes);
      setSalesAnalytics(salesRes);
      setInvAnalytics(invRes);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load dashboard telemetry.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Executive Inventory Overview" subtitle="Live intelligence synthesized from sales, stock, and supplier telemetry." />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (error || !summary || !salesAnalytics || !invAnalytics) {
    return (
      <div>
        <PageHeader title="Executive Inventory Overview" />
        <Banner type="error" message={error ?? 'No dashboard data available.'} />
      </div>
    );
  }

  const { kpis } = summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Inventory Overview"
        subtitle="Real-time demand forecasting, stockout exposure, and supplier reliability metrics."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <Link
              to="/decision-center"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span>AI Decision Center</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        }
      />

      {/* 8 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Products" value={formatNumber(kpis.total_products)} subtext={`${summary.inventory_summary.in_stock} healthy · ${summary.inventory_summary.out_of_stock} out of stock`} />
        <KpiCard label="Total Inventory Value" value={formatCurrency(kpis.total_inventory_value, currency)} subtext="Valued at unit cost price" tone="primary" />
        <KpiCard label="Total Sales Transactions" value={formatNumber(kpis.total_sales)} subtext={`${formatCurrency(kpis.total_revenue, currency)} cumulative`} />
        <KpiCard label="Monthly Revenue (30D)" value={formatCurrency(kpis.monthly_revenue, currency)} subtext="Trailing 30-day revenue" tone="success" />
        <KpiCard label="Low-Stock Products" value={formatNumber(kpis.low_stock_products)} subtext="At or below minimum threshold" tone={kpis.low_stock_products > 0 ? 'warning' : 'default'} />
        <KpiCard label="High-Risk Stockouts" value={formatNumber(kpis.high_risk_products)} subtext="Inside supplier lead-time window" tone={kpis.high_risk_products > 0 ? 'danger' : 'success'} />
        <KpiCard label="Pending Reorders" value={formatNumber(kpis.pending_reorders)} subtext="Budget-optimized purchase items" tone="primary" />
        <KpiCard label="Supplier Risk Count" value={formatNumber(kpis.supplier_risk_count)} subtext="High or medium delay risk vendors" tone={kpis.supplier_risk_count > 0 ? 'warning' : 'success'} />
      </div>

      {/* Primary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Daily Sales Revenue (30D)</h2>
              <p className="text-xs text-slate-500">Observed daily transaction totals</p>
            </div>
            <Link to="/sales" className="text-xs font-medium text-[#2563EB] hover:underline">
              View ledger
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesAnalytics.daily_sales_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0), currency)} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" fill="#2563EB" fillOpacity={0.12} strokeWidth={2} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Actual vs Predicted Demand (Holdout Backtest)</h2>
              <p className="text-xs text-slate-500">Lead SKU out-of-sample model validation</p>
            </div>
            <Link to="/forecasting" className="text-xs font-medium text-[#2563EB] hover:underline">
              Open forecasting
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesAnalytics.actual_vs_predicted}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#0F172A" strokeWidth={2} dot={{ r: 2 }} name="Actual Units" />
                <Line type="monotone" dataKey="predicted" stroke="#2563EB" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} name="Predicted Units" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Monthly Revenue (6 Months)</h2>
          <p className="text-xs text-slate-500 mb-4">Aggregated monthly sales turnover</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesAnalytics.monthly_revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0), currency)} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Stockout Risk Distribution</h2>
          <p className="text-xs text-slate-500 mb-4">SKU breakdown by risk classification</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={invAnalytics.stockout_risk_distribution}
                  dataKey="count"
                  nameKey="risk_level"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {invAnalytics.stockout_risk_distribution.map((entry) => (
                    <Cell key={entry.risk_level} fill={RISK_COLORS[entry.risk_level] ?? '#64748B'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Inventory Value by Category</h2>
          <p className="text-xs text-slate-500 mb-4">Capital distribution across catalog</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invAnalytics.inventory_by_category} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="category" type="category" width={105} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0), currency)} />
                <Bar dataKey="value" fill="#0F172A" radius={[0, 4, 4, 0]} name="Cost Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom Operational Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Critical Alerts</h2>
            <Link to="/alerts" className="text-xs font-medium text-[#2563EB] hover:underline">
              All alerts
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {summary.critical_alerts.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No unresolved alerts.</p>
            ) : (
              summary.critical_alerts.map((a) => (
                <div key={a.id} className="py-3 first:pt-1 last:pb-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500">{a.category.replace(/_/g, ' ')}</span>
                    <StatusTag level={a.severity as 'HIGH' | 'MEDIUM' | 'LOW'} />
                  </div>
                  <p className="text-sm text-slate-800">{a.message}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Top Reorder Priorities</h2>
            <Link to="/reorder-intelligence" className="text-xs font-medium text-[#2563EB] hover:underline">
              Optimize budget
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {summary.top_recommendations.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No pending reorder recommendations.</p>
            ) : (
              summary.top_recommendations.map((rec) => (
                <div key={rec.id} className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      #{rec.priority_rank} · {rec.product_name}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      Order {rec.recommended_quantity} units
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {formatCurrency(rec.total_cost, currency)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Recent Transactions</h2>
            <Link to="/sales" className="text-xs font-medium text-[#2563EB] hover:underline">
              Record sale
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {summary.recent_transactions.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No sales recorded yet.</p>
            ) : (
              summary.recent_transactions.map((tx) => (
                <div key={tx.id} className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-mono font-medium text-slate-900 truncate">{tx.reference_number}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatDateTime(tx.sale_date)} · {tx.item_count} line items
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#16A34A] tabular-nums shrink-0">
                    {formatCurrency(tx.total_amount, currency)}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
