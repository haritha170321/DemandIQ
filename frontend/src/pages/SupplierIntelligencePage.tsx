import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  KpiCard,
  LoadingSkeleton,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { SupplierRisk } from '../types';
import { getErrorMessage } from '../utils/format';

export default function SupplierIntelligencePage() {
  const [risks, setRisks] = useState<SupplierRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const items = await demandIqApi.getSupplierRisks();
        setRisks(items);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to analyze supplier delivery risks.'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSkeleton rows={6} />;
  if (error) return <Banner type="error" message={error} />;

  const highRisk = risks.filter((r) => r.risk_level === 'HIGH').length;
  const insufficient = risks.filter((r) => r.insufficient_records).length;
  const avgDelayPct =
    risks.length > 0
      ? (risks.reduce((s, r) => s + r.delay_percentage, 0) / risks.length).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier Delivery Risk Intelligence"
        subtitle="Evaluates on-time performance, average delay duration, and flags vendors lacking sufficient historical records."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="High-Risk Suppliers" value={highRisk} subtext="≥ 40% late deliveries or ≥ 3d avg delay" tone={highRisk > 0 ? 'danger' : 'success'} />
        <KpiCard label="Portfolio Average Delay Rate" value={`${avgDelayPct}%`} tone="primary" />
        <KpiCard label="Insufficient History Vendors" value={insufficient} subtext="Fewer than 3 completed deliveries" tone="warning" />
      </div>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-4">On-Time vs Delayed Deliveries by Supplier</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={risks}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="supplier_name" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="on_time_deliveries" fill="#16A34A" radius={[4, 4, 0, 0]} name="On Time" />
              <Bar dataKey="delayed_deliveries" fill="#DC2626" radius={[4, 4, 0, 0]} name="Delayed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Deliveries</th>
                <th className="px-4 py-3 text-right">On-Time / Late</th>
                <th className="px-4 py-3 text-right">Delay %</th>
                <th className="px-4 py-3 text-right">Effective Lead Time</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {risks.map((s) => (
                <tr key={s.supplier_id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{s.supplier_name}</div>
                    <div className="text-xs text-slate-500">{s.linked_products} linked SKUs · {s.contact_person}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{s.total_deliveries}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {s.on_time_deliveries} / {s.delayed_deliveries}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">{s.delay_percentage.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono">{s.avg_delivery_time_days}d</td>
                  <td className="px-4 py-3">
                    <StatusTag level={s.risk_level} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">{s.assessment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
