import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Banner } from '../components/ui';
import { getErrorMessage } from '../utils/format';

export default function LoginPage() {
  const { login, isPreviewMode } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(isPreviewMode ? 'demo@demandiq.ai' : '');
  const [password, setPassword] = useState(isPreviewMode ? 'DemandIQ#2026' : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid credentials. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoAccess() {
    setError(null);
    setSubmitting(true);
    try {
      await login('demo@demandiq.ai', 'DemandIQ#2026');
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not launch demo workspace.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white text-sm font-bold">
            DQ
          </span>
          <span className="text-xl font-display font-bold text-slate-900">DemandIQ</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">Sign in to your workspace</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">
          Access demand forecasting, stockout risk intelligence, and purchasing optimization.
        </p>

        {error && <Banner type="error" message={error} onClose={() => setError(null)} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Work email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {isPreviewMode && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleDemoAccess}
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium rounded-lg transition-colors"
            >
              Launch Demo Workspace (6-Month Dataset)
            </button>
          </div>
        )}

        <p className="text-sm text-slate-500 text-center mt-6">
          New to DemandIQ?{' '}
          <Link to="/register" className="text-[#2563EB] font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
