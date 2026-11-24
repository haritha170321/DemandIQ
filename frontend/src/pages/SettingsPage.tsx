import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { previewEngine } from '../services/previewEngine';
import { Banner, Card, PageHeader } from '../components/ui';
import { getErrorMessage } from '../utils/format';

export default function SettingsPage() {
  const { user, updateProfile, isPreviewMode } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [businessName, setBusinessName] = useState(user?.business_name ?? '');
  const [currency, setCurrency] = useState(user?.currency ?? 'INR');
  const [defaultBudget, setDefaultBudget] = useState(String(user?.default_budget ?? 50000));
  const [minMargin, setMinMargin] = useState(String(user?.min_profit_margin_pct ?? 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        business_name: businessName.trim(),
        currency,
        default_budget: Number(defaultBudget),
        min_profit_margin_pct: Number(minMargin),
      });
      setSuccess('Workspace preferences saved.');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save settings.'));
    } finally {
      setSaving(false);
    }
  }

  function handleResetDemo() {
    previewEngine.resetDemoData();
    setSuccess('Demo dataset reset to clean 6-month baseline. Refreshing view...');
    window.location.reload();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Workspace Settings"
        subtitle="Configure business profile, default purchasing budget, and minimum profit margin guardrails."
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}
      {success && <Banner type="success" message={success} onClose={() => setSuccess(null)} />}

      <Card className="p-6">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Business Name</label>
              <input
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Display Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Default Reorder Budget</label>
              <input
                type="number"
                min={500}
                step={500}
                value={defaultBudget}
                onChange={(e) => setDefaultBudget(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Min Profit Margin Floor (%)</label>
              <input
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={minMargin}
                onChange={(e) => setMinMargin(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Backend Connection</h2>
        <p className="text-sm text-slate-600">
          {isPreviewMode
            ? 'Currently running in Preview Sandbox Mode with the 6-month seeded demo dataset. Set VITE_API_BASE_URL in Vercel or .env to connect to your FastAPI + PostgreSQL backend.'
            : `Connected to FastAPI backend at ${import.meta.env.VITE_API_BASE_URL}.`}
        </p>
        {isPreviewMode && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleResetDemo}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Reset Demo Dataset
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
