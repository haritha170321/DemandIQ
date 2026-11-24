import React, { useCallback, useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { AlertItem } from '../types';
import { formatDateTime, getErrorMessage } from '../utils/format';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [severity, setSeverity] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await demandIqApi.listAlerts({
        severity: severity !== 'ALL' ? severity : undefined,
        category: category !== 'ALL' ? category : undefined,
      });
      setAlerts(res.items);
      setUnreadCount(res.unread_count);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load alerts.'));
    } finally {
      setLoading(false);
    }
  }, [severity, category]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  async function handleMarkRead(id: number) {
    await demandIqApi.markAlertRead(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    await demandIqApi.markAllAlertsRead();
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Notifications"
        subtitle={`Deduplicated operational alerts across stockouts, supplier delays, slow-moving SKUs, and budget constraints (${unreadCount} unread).`}
        actions={
          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
        }
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="ALL">All Severities</option>
          <option value="HIGH">High Severity</option>
          <option value="MEDIUM">Medium Severity</option>
          <option value="LOW">Low Severity</option>
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="ALL">All Categories</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
          <option value="LOW_INVENTORY">Low Inventory</option>
          <option value="EXPECTED_STOCKOUT">Expected Stockout</option>
          <option value="SUPPLIER_DELAY_RISK">Supplier Delay Risk</option>
          <option value="SLOW_MOVING_PRODUCT">Slow-Moving Product</option>
          <option value="INSUFFICIENT_BUDGET">Insufficient Budget</option>
        </select>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No active alerts"
          description="No unresolved alerts match your current severity or category filter."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                a.is_read ? 'bg-white' : 'bg-blue-50/30'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <StatusTag level={a.severity} />
                  <span className="font-medium text-slate-700">{a.category.replace(/_/g, ' ')}</span>
                  <span>·</span>
                  <span>{formatDateTime(a.created_at)}</span>
                  {!a.is_read && <span className="text-[#2563EB] font-semibold">· Unread</span>}
                </div>
                <p className="text-sm text-slate-900">{a.message}</p>
              </div>
              {!a.is_read && (
                <button
                  onClick={() => handleMarkRead(a.id)}
                  className="px-3 py-1.5 text-xs font-medium text-[#2563EB] border border-blue-200 rounded-lg hover:bg-blue-50 shrink-0"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
