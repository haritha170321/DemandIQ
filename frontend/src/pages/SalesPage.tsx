import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  KpiCard,
  LoadingSkeleton,
  Modal,
  PageHeader,
} from '../components/ui';
import { Product, Sale } from '../types';
import { formatCurrency, formatDateTime, getErrorMessage } from '../utils/format';

export default function SalesPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';

  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState({ count: 0, total_revenue: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [period, setPeriod] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('monthly');
  const [productFilter, setProductFilter] = useState('');

  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [cart, setCart] = useState<Array<{ product_id: number; quantity: number }>>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [salesRes, prodRes] = await Promise.all([
        demandIqApi.listSales({
          period: period === 'all' ? undefined : period,
          product_id: productFilter ? Number(productFilter) : undefined,
        }),
        demandIqApi.listProducts(),
      ]);
      setSales(salesRes.items);
      setSummary(salesRes.summary);
      setProducts(prodRes.items);
      if (prodRes.items.length > 0 && cart.length === 0) {
        const firstInStock = prodRes.items.find((p) => p.current_stock > 0) ?? prodRes.items[0];
        setCart([{ product_id: firstInStock.id, quantity: 1 }]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load sales history.'));
    } finally {
      setLoading(false);
    }
  }, [period, productFilter, cart.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, row) => {
      const p = productsById.get(row.product_id);
      return acc + (p ? p.selling_price * row.quantity : 0);
    }, 0);
  }, [cart, productsById]);

  function addCartRow() {
    const firstAvailable = products.find((p) => p.current_stock > 0) ?? products[0];
    if (!firstAvailable) return;
    setCart((prev) => [...prev, { product_id: firstAvailable.id, quantity: 1 }]);
  }

  async function handleRecordSale(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const sale = await demandIqApi.createSale({
        items: cart,
        notes: notes.trim() || undefined,
      });
      setSaleModalOpen(false);
      setNotes('');
      setSuccess(`Recorded sale ${sale.reference_number} (${formatCurrency(sale.total_amount, currency)}) and updated inventory.`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to record sale transaction.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Transactions"
        subtitle="Record point-of-sale transactions with atomic stock validation and feed historical demand models."
        actions={
          <button
            onClick={() => setSaleModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Record Sale</span>
          </button>
        }
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Filtered Transactions" value={summary.count} />
        <KpiCard label="Filtered Revenue" value={formatCurrency(summary.total_revenue, currency)} tone="success" />
        <KpiCard
          label="Average Order Value"
          value={formatCurrency(summary.count > 0 ? summary.total_revenue / summary.count : 0, currency)}
          tone="primary"
        />
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['daily', 'weekly', 'monthly', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                period === p ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'all' ? 'All Time (6M)' : p}
            </button>
          ))}
        </div>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.slice(0, 40).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-medium text-slate-900">{s.reference_number}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(s.sale_date)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.items.length} SKUs · {s.items.reduce((a, b) => a + b.quantity, 0)} units
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[#16A34A]">
                      {formatCurrency(s.total_amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetailSale(s)}
                        className="text-xs font-medium text-[#2563EB] hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New Sale Modal */}
      <Modal open={saleModalOpen} title="Record New Sale" onClose={() => setSaleModalOpen(false)} maxWidth="max-w-xl">
        <form onSubmit={handleRecordSale} className="space-y-4">
          <div className="space-y-2.5">
            {cart.map((row, idx) => {
              const p = productsById.get(row.product_id);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={row.product_id}
                    onChange={(e) => {
                      const next = [...cart];
                      next[idx].product_id = Number(e.target.value);
                      setCart(next);
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {products.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.name} ({formatCurrency(prod.selling_price, currency)} · {prod.current_stock} in stock)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={p ? Math.max(1, p.current_stock) : 9999}
                    value={row.quantity}
                    onChange={(e) => {
                      const next = [...cart];
                      next[idx].quantity = Math.max(1, Number(e.target.value));
                      setCart(next);
                    }}
                    className="w-20 px-2.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                  {cart.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}
                      className="p-2 text-slate-400 hover:text-[#DC2626]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addCartRow}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add another product
          </button>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Notes (Optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Counter POS receipt or customer note"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block">Transaction Total</span>
              <span className="text-lg font-bold font-mono text-slate-900">
                {formatCurrency(cartSubtotal, currency)}
              </span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSaleModalOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
              >
                {submitting ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Sale Detail Modal */}
      <Modal open={Boolean(detailSale)} title={`Receipt · ${detailSale?.reference_number ?? ''}`} onClose={() => setDetailSale(null)}>
        {detailSale && (
          <div className="space-y-4 text-sm">
            <div className="text-xs text-slate-500">{formatDateTime(detailSale.sale_date)}</div>
            <div className="divide-y divide-slate-100">
              {detailSale.items.map((it) => (
                <div key={it.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{it.product_name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {it.quantity} × {formatCurrency(it.unit_price, currency)}
                    </div>
                  </div>
                  <div className="font-mono font-semibold">{formatCurrency(it.line_total, currency)}</div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between font-bold">
              <span>Total</span>
              <span className="font-mono">{formatCurrency(detailSale.total_amount, currency)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
