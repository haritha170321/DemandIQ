import React, { useCallback, useEffect, useState } from 'react';
import { Edit2, History, Plus, Search, Trash2 } from 'lucide-react';
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
import { Supplier, SupplierDelivery } from '../types';
import { formatDate, getErrorMessage } from '../utils/format';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  const [historySupplier, setHistorySupplier] = useState<Supplier | null>(null);
  const [deliveries, setDeliveries] = useState<SupplierDelivery[]>([]);
  const [deliveryForm, setDeliveryForm] = useState({
    po_reference: '',
    expected_delivery_date: new Date().toISOString().slice(0, 10),
    actual_delivery_date: new Date().toISOString().slice(0, 10),
  });

  const [form, setForm] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    avg_lead_time_days: '5',
    reliability_status: 'Reliable',
  });

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await demandIqApi.listSuppliers(search || undefined);
      setSuppliers(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load suppliers.'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      avg_lead_time_days: '5',
      reliability_status: 'Reliable',
    });
    setFormOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contact_person: s.contact_person,
      email: s.email,
      phone: s.phone,
      address: s.address ?? '',
      avg_lead_time_days: String(s.avg_lead_time_days),
      reliability_status: s.reliability_status,
    });
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        avg_lead_time_days: Number(form.avg_lead_time_days),
      };
      if (editing) {
        await demandIqApi.updateSupplier(editing.id, payload);
        setSuccess(`Updated supplier "${payload.name}".`);
      } else {
        await demandIqApi.createSupplier(payload);
        setSuccess(`Added supplier "${payload.name}".`);
      }
      setFormOpen(false);
      await loadSuppliers();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save supplier.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Supplier) {
    try {
      await demandIqApi.deleteSupplier(s.id);
      setSuccess(`Deleted supplier "${s.name}".`);
      await loadSuppliers();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete supplier.'));
    }
  }

  async function openHistory(s: Supplier) {
    setHistorySupplier(s);
    const list = await demandIqApi.getSupplierDeliveries(s.id);
    setDeliveries(list);
  }

  async function handleLogDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!historySupplier) return;
    try {
      await demandIqApi.logSupplierDelivery({
        supplier_id: historySupplier.id,
        po_reference: deliveryForm.po_reference,
        expected_delivery_date: deliveryForm.expected_delivery_date,
        actual_delivery_date: deliveryForm.actual_delivery_date || undefined,
      });
      const updated = await demandIqApi.getSupplierDeliveries(historySupplier.id);
      setDeliveries(updated);
      setDeliveryForm({ ...deliveryForm, po_reference: '' });
      setSuccess(`Logged delivery record for ${historySupplier.name}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to log delivery.'));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers & Lead Times"
        subtitle="Manage vendor contacts, promised lead times, and purchase order delivery logs."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        }
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess(null)} />}

      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
        </div>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers found"
          description="Add your first vendor to track lead times and delivery reliability."
          action={
            <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg">
              Add Supplier
            </button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Email & Phone</th>
                  <th className="px-4 py-3 text-right">Lead Time</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">{s.address || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.contact_person}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800">{s.email}</div>
                      <div className="text-xs font-mono text-slate-500">{s.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{s.avg_lead_time_days} days</td>
                    <td className="px-4 py-3">
                      <StatusTag
                        level={
                          s.reliability_status === 'At Risk'
                            ? 'HIGH'
                            : s.reliability_status === 'Watchlist'
                            ? 'MEDIUM'
                            : 'LOW'
                        }
                        label={s.reliability_status}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openHistory(s)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                          title="Delivery History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(s)}
                          className="p-1.5 text-slate-500 hover:text-[#2563EB] rounded hover:bg-slate-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-1.5 text-slate-500 hover:text-[#DC2626] rounded hover:bg-slate-100"
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
        </Card>
      )}

      {/* Supplier Create/Edit Modal */}
      <Modal open={formOpen} title={editing ? `Edit ${editing.name}` : 'Add Supplier'} onClose={() => setFormOpen(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Supplier Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label>
              <input required value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Average Lead Time (Days)</label>
              <input type="number" step="0.5" min="0.5" required value={form.avg_lead_time_days} onChange={(e) => setForm({ ...form, avg_lead_time_days: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reliability Status</label>
              <select value={form.reliability_status} onChange={(e) => setForm({ ...form, reliability_status: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                <option value="Reliable">Reliable</option>
                <option value="Watchlist">Watchlist</option>
                <option value="At Risk">At Risk</option>
                <option value="New">New</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Location / Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">
              {saving ? 'Saving...' : 'Save Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delivery History & Log Modal */}
      <Modal
        open={Boolean(historySupplier)}
        title={`Deliveries · ${historySupplier?.name ?? ''}`}
        onClose={() => setHistorySupplier(null)}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleLogDelivery} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-5 pb-4 border-b border-slate-200">
          <input
            required
            placeholder="PO Reference"
            value={deliveryForm.po_reference}
            onChange={(e) => setDeliveryForm({ ...deliveryForm, po_reference: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
          />
          <input
            type="date"
            required
            value={deliveryForm.expected_delivery_date}
            onChange={(e) => setDeliveryForm({ ...deliveryForm, expected_delivery_date: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="date"
            value={deliveryForm.actual_delivery_date}
            onChange={(e) => setDeliveryForm({ ...deliveryForm, actual_delivery_date: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
          <button type="submit" className="px-3 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700">
            Log Delivery
          </button>
        </form>

        {deliveries.length === 0 ? (
          <p className="text-sm text-slate-500">No deliveries logged for this supplier yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 text-sm">
            {deliveries.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono font-medium text-slate-900">{d.po_reference}</div>
                  <div className="text-xs text-slate-500">
                    Expected {formatDate(d.expected_delivery_date)} · Actual {formatDate(d.actual_delivery_date)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.delay_days > 0 && <span className="text-xs font-mono text-[#DC2626]">+{d.delay_days}d</span>}
                  <StatusTag
                    level={d.delivery_status === 'DELAYED' ? 'HIGH' : d.delivery_status === 'ON_TIME' ? 'LOW' : 'MEDIUM'}
                    label={d.delivery_status.replace('_', ' ')}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
