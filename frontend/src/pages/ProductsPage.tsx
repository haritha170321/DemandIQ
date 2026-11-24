import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit2, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  EmptyState,
  LoadingSkeleton,
  Modal,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { Product, Supplier } from '../types';
import { formatCurrency, formatDateTime, formatNumber, getErrorMessage } from '../utils/format';

export default function ProductsPage() {
  const { user } = useAuth();
  const currency = user?.currency ?? 'INR';
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [category, setCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [formOpen, setFormOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: 'Dairy & Fresh',
    description: '',
    selling_price: '100',
    cost_price: '70',
    current_stock: '25',
    minimum_stock: '10',
    reorder_level: '20',
    supplier_id: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, supRes] = await Promise.all([
        demandIqApi.listProducts({
          search: search || undefined,
          category: category !== 'ALL' ? category : undefined,
          stock_status: stockFilter !== 'ALL' ? stockFilter : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        demandIqApi.listSuppliers(),
      ]);
      setProducts(prodRes.items);
      setCategories(prodRes.categories);
      setSuppliers(supRes);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load products.'));
    } finally {
      setLoading(false);
    }
  }, [search, category, stockFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== search) {
      setSearch(q);
    }
  }, [searchParams, search]);

  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const paginated = useMemo(
    () => products.slice((page - 1) * pageSize, page * pageSize),
    [products, page],
  );

  function openCreateModal() {
    setEditing(null);
    setForm({
      name: '',
      sku: '',
      category: categories[0] ?? 'Dairy & Fresh',
      description: '',
      selling_price: '100',
      cost_price: '70',
      current_stock: '25',
      minimum_stock: '10',
      reorder_level: '20',
      supplier_id: suppliers[0] ? String(suppliers[0].id) : '',
    });
    setFormOpen(true);
  }

  function openEditModal(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      description: p.description ?? '',
      selling_price: String(p.selling_price),
      cost_price: String(p.cost_price),
      current_stock: String(p.current_stock),
      minimum_stock: String(p.minimum_stock),
      reorder_level: String(p.reorder_level),
      supplier_id: p.supplier_id ? String(p.supplier_id) : '',
    });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        selling_price: Number(form.selling_price),
        cost_price: Number(form.cost_price),
        current_stock: Number(form.current_stock),
        minimum_stock: Number(form.minimum_stock),
        reorder_level: Number(form.reorder_level),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      };
      if (editing) {
        await demandIqApi.updateProduct(editing.id, payload);
        setSuccess(`Updated product "${payload.name}".`);
      } else {
        await demandIqApi.createProduct(payload);
        setSuccess(`Created product "${payload.name}".`);
      }
      setFormOpen(false);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save product.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Product) {
    setError(null);
    try {
      await demandIqApi.deleteProduct(p.id);
      setSuccess(`Deleted product "${p.name}".`);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete product.'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Catalog"
        subtitle="Manage SKUs, pricing margins, reorder thresholds, and supplier assignments."
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        }
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Filter Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                if (!e.target.value) setSearchParams({});
              }}
              placeholder="Filter by name or SKU..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="updated_at">Sort: Updated</option>
              <option value="name">Sort: Name</option>
              <option value="current_stock">Sort: Stock</option>
              <option value="selling_price">Sort: Price</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100"
            >
              {sortOrder === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : paginated.length === 0 ? (
        <EmptyState
          title="No products match these filters"
          description="Adjust your search criteria or add a new SKU to the catalog."
          action={
            <button
              onClick={openCreateModal}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
            >
              Add First Product
            </button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Product & SKU</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Sell Price</th>
                  <th className="px-4 py-3 text-right">Stock / Min</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{p.name}</div>
                      <div className="text-xs font-mono text-slate-500">{p.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.category}</td>
                    <td className="px-4 py-3 text-slate-600">{p.supplier_name ?? 'Unassigned'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(p.cost_price, currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">
                      {formatCurrency(p.selling_price, currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-semibold text-slate-900">{formatNumber(p.current_stock)}</span>
                      <span className="text-slate-400"> / {p.minimum_stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusTag level={p.stock_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setDetailProduct(p)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          aria-label={`View ${p.name}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-[#2563EB] rounded hover:bg-slate-100"
                          aria-label={`Edit ${p.name}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-slate-500 hover:text-[#DC2626] rounded hover:bg-slate-100"
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, products.length)} of {products.length} products
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
              >
                Previous
              </button>
              <span className="font-mono">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={formOpen}
        title={editing ? `Edit ${editing.name}` : 'Add New Product'}
        onClose={() => setFormOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Product Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">SKU</label>
              <input
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <input
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Supplier</label>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Unassigned</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Cost Price</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.cost_price}
                onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Selling Price</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Current Stock</label>
              <input
                type="number"
                min="0"
                required
                value={form.current_stock}
                onChange={(e) => setForm({ ...form, current_stock: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Minimum Stock</label>
              <input
                type="number"
                min="0"
                required
                value={form.minimum_stock}
                onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                required
                value={form.reorder_level}
                onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Product Details Modal */}
      <Modal
        open={Boolean(detailProduct)}
        title={detailProduct?.name ?? 'Product Details'}
        onClose={() => setDetailProduct(null)}
      >
        {detailProduct && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-slate-500">{detailProduct.sku}</span>
              <StatusTag level={detailProduct.stock_status} />
            </div>
            <p className="text-slate-600">{detailProduct.description || 'No description provided.'}</p>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div><span className="text-slate-500 block text-xs">Category</span><span className="font-medium">{detailProduct.category}</span></div>
              <div><span className="text-slate-500 block text-xs">Supplier</span><span className="font-medium">{detailProduct.supplier_name ?? 'Unassigned'}</span></div>
              <div><span className="text-slate-500 block text-xs">Selling Price</span><span className="font-mono font-semibold">{formatCurrency(detailProduct.selling_price, currency)}</span></div>
              <div><span className="text-slate-500 block text-xs">Cost Price</span><span className="font-mono font-semibold">{formatCurrency(detailProduct.cost_price, currency)}</span></div>
              <div><span className="text-slate-500 block text-xs">Current Stock</span><span className="font-mono font-semibold">{detailProduct.current_stock} units</span></div>
              <div><span className="text-slate-500 block text-xs">Reorder / Min</span><span className="font-mono font-semibold">{detailProduct.reorder_level} / {detailProduct.minimum_stock}</span></div>
              <div><span className="text-slate-500 block text-xs">Created</span><span>{formatDateTime(detailProduct.created_at)}</span></div>
              <div><span className="text-slate-500 block text-xs">Updated</span><span>{formatDateTime(detailProduct.updated_at)}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
