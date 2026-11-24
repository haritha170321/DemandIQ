import React, { useEffect, useState } from 'react';
import {
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
import { useAuth } from '../context/AuthContext';
import { demandIqApi } from '../services/api';
import { Banner, Card, LoadingSkeleton, PageHeader } from '../components/ui';
import { InventoryAnalytics, SalesAnalytics } from '../types';
import { formatCurrency, getErrorMessage } from '../utils/format';

const RISK_COLORS: Record<string, string> = {
  HIGH: '#DC2626',
  MEDIUM: '#F59E0B',
  LOW: '#16A34A',
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';

  const [sales, setSales] = useState<SalesAnalytics | null>(null);
  const [inventory, setInventory] = useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, i] = await Promise.all([
          demandIqApi.getSalesAnalytics(),
          demandIqApi.getInventoryAnalytics(),
        ]);
        setSales(s);
        setInventory(i);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load analytics.'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSkeleton rows={8} />;
  if (error || !sales || !inventory) return <Banner type="error" message={error ?? 'Analytics unavailable.'} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence & Analytics"
        subtitle="Comprehensive 8-chart view across sales velocity, category capital, forecast backtesting, and vendor delivery reliability."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Daily Sales Trend */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">1. Daily Sales Trend (30D Units & Revenue)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sales.daily_sales_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} name="Revenue" />
                <Line type="monotone" dataKey="units" stroke="#16A34A" strokeWidth={2} name="Units Sold" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 2. Monthly Revenue */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">2. Monthly Revenue Trajectory</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales.monthly_revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0), currency)} />
                <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} name="Monthly Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 3. Top-Selling Products */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">3. Top-Selling Products (30D Units)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales.top_selling_products} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Bar dataKey="units_30d" fill="#16A34A" radius={[0, 4, 4, 0]} name="Units Sold (30D)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 4. Slow-Moving Products */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">4. Slow-Moving Products (Days Since Last Sale)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales.slow_moving_products} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip />
                <Bar dataKey="days_since_last_sale" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Days Idle" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 5. Inventory by Category */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">5. Inventory Value by Category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventory.inventory_by_category}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip formatter={(val) => formatCurrency(Number(val ?? 0), currency)} />
                <Bar dataKey="value" fill="#0F172A" radius={[4, 4, 0, 0]} name="Inventory Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 6. Actual vs Predicted Demand */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">6. Actual vs Predicted Demand (Validation Window)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sales.actual_vs_predicted}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke="#0F172A" strokeWidth={2} name="Actual" />
                <Line type="monotone" dataKey="predicted" stroke="#2563EB" strokeWidth={2} strokeDasharray="4 4" name="Predicted" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 7. Stockout Risk Distribution */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">7. Stockout Risk Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={inventory.stockout_risk_distribution} dataKey="count" nameKey="risk_level" cx="50%" cy="50%" innerRadius={50} outerRadius={85}>
                  {inventory.stockout_risk_distribution.map((entry) => (
                    <Cell key={entry.risk_level} fill={RISK_COLORS[entry.risk_level] ?? '#64748B'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 8. Supplier Performance */}
        <Card className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">8. Supplier Delivery Performance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventory.supplier_performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="supplier_name" tick={{ fontSize: 10, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="on_time_deliveries" stackId="a" fill="#16A34A" name="On Time" />
                <Bar dataKey="delayed_deliveries" stackId="a" fill="#DC2626" name="Delayed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
