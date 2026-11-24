import React, { useCallback, useEffect, useState } from 'react';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  KpiCard,
  LoadingSkeleton,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { InventoryRisk } from '../types';
import { formatDate, formatNumber, getErrorMessage } from '../utils/format';

export default function StockoutRiskPage() {
  const [risks, setRisks] = useState<InventoryRisk[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRisks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await demandIqApi.getRisks(filter);
      setRisks(items);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to calculate stockout risks.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadRisks();
  }, [loadRisks]);

  const highCount = risks.filter((r) => r.risk_level === 'HIGH').length;
  const medCount = risks.filter((r) => r.risk_level === 'MEDIUM').length;
  const lowCount = risks.filter((r) => r.risk_level === 'LOW').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stockout Risk Prediction"
        subtitle="Monitors days of inventory remaining against trailing daily demand and vendor lead times."
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="High Risk SKUs" value={highCount} subtext="Stockout within lead time or below minimum" tone="danger" />
        <KpiCard label="Medium Risk SKUs" value={medCount} subtext="Approaching reorder point" tone="warning" />
        <KpiCard label="Low Risk SKUs" value={lowCount} subtext="Healthy coverage buffer" tone="success" />
      </div>

      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === lvl ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lvl === 'ALL' ? 'All Levels' : `${lvl} Risk`}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          Rule: HIGH if stock = 0, below min threshold, or days remaining ≤ lead time + 2 days.
        </span>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Avg Demand/Day</th>
                  <th className="px-4 py-3 text-right">Days Left</th>
                  <th className="px-4 py-3 text-right">Lead Time</th>
                  <th className="px-4 py-3">Expected Stockout</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Recommended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {risks.map((r) => (
                  <tr key={r.product_id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.product_name}</div>
                      <div className="text-xs font-mono text-slate-500">{r.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{formatNumber(r.available_stock)}</td>
                    <td className="px-4 py-3 text-right font-mono">{r.avg_daily_demand.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {r.days_remaining !== null ? `${r.days_remaining.toFixed(1)}d` : 'No demand'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{r.supplier_lead_time_days}d</td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(r.expected_stockout_date)}</td>
                    <td className="px-4 py-3">
                      <StatusTag level={r.risk_level} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs">{r.recommended_action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
