import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  KpiCard,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { InventoryItem, InventoryMovement } from '../types';
import { formatCurrency, formatDateTime, formatNumber, getErrorMessage } from '../utils/format';

export default function InventoryPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';

  const [summary, setSummary] = useState<{
    total_skus: number;
    total_units: number;
    total_cost_valuation: number;
    total_retail_valuation: number;
    low_stock_count: number;
    out_of_stock_count: number;
  } | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moveForm, setMoveForm] = useState({
    product_id: '',
    movement_type: 'ADDITION' as 'ADDITION' | 'REDUCTION' | 'ADJUSTMENT',
    quantity: '10',
    reason: 'Supplier replenishment received',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, movRes] = await Promise.all([
        demandIqApi.getInventory(),
        demandIqApi.listMovements(),
      ]);
      setSummary(invRes.summary);
      setItems(invRes.items);
      setMovements(movRes);
      if (invRes.items.length > 0 && !moveForm.product_id) {
        setMoveForm((f) => ({ ...f, product_id: String(invRes.items[0].product_id) }));
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load inventory.'));
    } finally {
      setLoading(false);
    }
  }, [moveForm.product_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await demandIqApi.createMovement({
        product_id: Number(moveForm.product_id),
        movement_type: moveForm.movement_type,
        quantity: Number(moveForm.quantity),
        reason: moveForm.reason.trim(),
      });
      setModalOpen(false);
      setSuccess('Inventory movement recorded and stockout risks recalculated.');
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid stock adjustment.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Ledger & Valuation"
        subtitle="Track real-time stock quantities, cost valuation, and auditable movement history."
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
          >
            <ArrowDownUp className="w-4 h-4" />
            <span>Record Stock Movement</span>
          </button>
        }
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess(null)} />}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total SKUs / Units" value={`${summary.total_skus} / ${formatNumber(summary.total_units)}`} />
          <KpiCard label="Cost Valuation" value={formatCurrency(summary.total_cost_valuation, currency)} tone="primary" />
          <KpiCard label="Retail Valuation" value={formatCurrency(summary.total_retail_valuation, currency)} tone="success" />
          <KpiCard
            label="Low / Out of Stock"
            value={`${summary.low_stock_count} / ${summary.out_of_stock_count}`}
            tone={summary.out_of_stock_count > 0 ? 'danger' : 'warning'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Current Stock Positions</h2>
          </div>
          <div className="overflow-x-auto max-h-[540px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Valuation</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => (
                  <tr key={it.product_id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{it.name}</div>
                      <div className="text-xs font-mono text-slate-500">{it.sku} · {it.category}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                      {it.current_stock}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatCurrency(it.inventory_value, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusTag level={it.stock_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="lg:col-span-5 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Movement History</h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
            {movements.map((m) => (
              <div key={m.id} className="px-5 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{m.product_name}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {m.movement_type} · {m.previous_quantity} → {m.new_quantity}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {m.reason} · {formatDateTime(m.created_at)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={modalOpen} title="Record Inventory Movement" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleMovement} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Product</label>
            <select
              value={moveForm.product_id}
              onChange={(e) => setMoveForm({ ...moveForm, product_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {items.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name} (On hand: {p.current_stock})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Movement Type</label>
              <select
                value={moveForm.movement_type}
                onChange={(e) =>
                  setMoveForm({
                    ...moveForm,
                    movement_type: e.target.value as 'ADDITION' | 'REDUCTION' | 'ADJUSTMENT',
                  })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="ADDITION">Stock Addition (+)</option>
                <option value="REDUCTION">Stock Reduction (-)</option>
                <option value="ADJUSTMENT">Exact Audit Count (=)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min={moveForm.movement_type === 'ADJUSTMENT' ? 0 : 1}
                required
                value={moveForm.quantity}
                onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason / Reference</label>
            <input
              required
              minLength={2}
              value={moveForm.reason}
              onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">
              {saving ? 'Applying...' : 'Confirm Movement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
