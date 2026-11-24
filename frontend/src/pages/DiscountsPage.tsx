import React, { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { DiscountRecommendation } from '../types';
import { formatCurrency, getErrorMessage } from '../utils/format';

export default function DiscountsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';

  const [minMargin, setMinMargin] = useState<string>(String(user?.min_profit_margin_pct ?? 10));
  const [idleThreshold, setIdleThreshold] = useState<string>('21');
  const [items, setItems] = useState<DiscountRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await demandIqApi.generateDiscounts({
        min_profit_margin_pct: Number(minMargin),
        slow_moving_days_threshold: Number(idleThreshold),
      });
      setItems(res);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate discount recommendations.'));
    } finally {
      setLoading(false);
    }
  }, [minMargin, idleThreshold]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  async function handleAction(id: number, status: 'ACCEPTED' | 'REJECTED') {
    try {
      await demandIqApi.updateDiscountStatus(id, status);
      setItems((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
      setSuccess(
        status === 'ACCEPTED'
          ? 'Markdown accepted and product selling price updated.'
          : 'Discount recommendation rejected.',
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update discount status.'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligent Discount Recommendations"
        subtitle="Clears slow-moving inventory with margin-protected markdown pricing that never drops below your minimum profit floor."
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess(null)} />}

      <Card className="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runAnalysis();
          }}
          className="flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Min Profit Margin Floor (%)</label>
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              value={minMargin}
              onChange={(e) => setMinMargin(e.target.value)}
              className="w-44 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Slow-Moving Threshold (Days Idle)</label>
            <input
              type="number"
              min={7}
              max={180}
              value={idleThreshold}
              onChange={(e) => setIdleThreshold(e.target.value)}
              className="w-44 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
          >
            Recalculate Discounts
          </button>
        </form>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No stagnant inventory requires discounting"
          description="All in-stock SKUs are moving above your threshold or are already at the minimum profit margin floor."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((d) => {
            const marginPct = ((d.estimated_profit_per_unit / d.new_selling_price) * 100).toFixed(1);
            return (
              <Card key={d.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{d.product_name}</h3>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                      {d.sku} · {d.days_since_last_sale}d idle · {d.current_stock} units on hand
                    </div>
                  </div>
                  <StatusTag level={d.status} />
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-100 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Recommended Cut</span>
                    <span className="font-mono font-bold text-[#2563EB]">-{d.recommended_discount_pct}%</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">New Price</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(d.new_selling_price, currency)}
                    </span>
                    <span className="text-xs text-slate-400 line-through ml-1.5">
                      {formatCurrency(d.current_selling_price, currency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Unit Profit</span>
                    <span className="font-mono font-semibold text-[#16A34A]">
                      {formatCurrency(d.estimated_profit_per_unit, currency)} ({marginPct}%)
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{d.rationale}</p>
                <p className="text-xs font-medium text-slate-800">{d.estimated_stock_clearing_impact}</p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleAction(d.id, 'REJECTED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    onClick={() => handleAction(d.id, 'ACCEPTED')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#16A34A] rounded-lg hover:bg-emerald-700"
                  >
                    <Check className="w-3.5 h-3.5" /> Apply Discount
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
