import React, { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
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
import { ReorderPlanResponse } from '../types';
import { formatCurrency, formatNumber, getErrorMessage } from '../utils/format';

export default function ReorderIntelligencePage() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';

  const [budget, setBudget] = useState<string>(String(user?.default_budget ?? 50000));
  const [plan, setPlan] = useState<ReorderPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const runOptimizer = useCallback(async (budgetAmount: number) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await demandIqApi.generateReorder(budgetAmount);
      setPlan(res);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate budget-aware reorder plan.'));
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  }, []);

  useEffect(() => {
    runOptimizer(Number(budget) || 50000);
  }, [runOptimizer]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAction(recId: number, status: 'ACCEPTED' | 'REJECTED') {
    try {
      await demandIqApi.updateReorderStatus(recId, status);
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              recommendations: prev.recommendations.map((r) => (r.id === recId ? { ...r, status } : r)),
            }
          : prev,
      );
      setSuccess(`Marked recommendation #${recId} as ${status.toLowerCase()}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update recommendation status.'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget-Aware Reorder Intelligence"
        subtitle="Prioritizes critical SKUs by stockout risk, lead time, and profit contribution strictly within your purchasing budget."
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess(null)} />}

      <Card className="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runOptimizer(Number(budget));
          }}
          className="flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Available Purchasing Budget ({currency})
            </label>
            <input
              type="number"
              min={500}
              step={500}
              required
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-56 px-3.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {generating ? 'Optimizing...' : 'Recalculate Reorder Plan'}
          </button>
        </form>

        {plan && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
              <span>Budget Utilization ({plan.budget_utilization_pct}%)</span>
              <span className="font-mono">
                {formatCurrency(plan.total_allocated_cost, currency)} / {formatCurrency(plan.budget, currency)}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563EB] transition-all"
                style={{ width: `${Math.min(100, plan.budget_utilization_pct)}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : plan ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <KpiCard label="Purchasing Budget" value={formatCurrency(plan.budget, currency)} />
            <KpiCard label="Allocated Order Cost" value={formatCurrency(plan.total_allocated_cost, currency)} tone="primary" />
            <KpiCard label="Remaining Budget" value={formatCurrency(plan.remaining_budget, currency)} tone="success" />
            <KpiCard
              label="Total Ideal Replenishment"
              value={formatCurrency(plan.total_ideal_cost, currency)}
              subtext={plan.total_ideal_cost > plan.budget ? 'Exceeds current budget' : 'Fully covered by budget'}
              tone={plan.total_ideal_cost > plan.budget ? 'warning' : 'default'}
            />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Order Qty</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Total Cost</th>
                    <th className="px-4 py-3">Rationale</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plan.recommendations.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-bold text-[#2563EB]">#{rec.priority_rank}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{rec.product_name}</div>
                        <div className="text-xs font-mono text-slate-500">{rec.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatNumber(rec.recommended_quantity)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(rec.unit_cost, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(rec.total_cost, currency)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-sm">{rec.rationale}</td>
                      <td className="px-4 py-3">
                        <StatusTag level={rec.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleAction(rec.id, 'ACCEPTED')}
                            className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"
                            title="Accept recommendation"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleAction(rec.id, 'REJECTED')}
                            className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                            title="Reject recommendation"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
