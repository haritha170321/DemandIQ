import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  EmptyState,
  LoadingSkeleton,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { DecisionInsight } from '../types';
import { getErrorMessage } from '../utils/format';

export default function DecisionCenterPage() {
  const [insights, setInsights] = useState<DecisionInsight[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDecisions = useCallback(async (enhance = false) => {
    setLoading(true);
    setError(null);
    try {
      const items = await demandIqApi.getDecisions(enhance);
      setInsights(items);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to synthesize AI Decision Center insights.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecisions(false);
  }, [loadDecisions]);

  const filtered = insights.filter((i) => priorityFilter === 'ALL' || i.priority === priorityFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Decision Center"
        subtitle="Synthesizes demand trends, stockout risks, supplier delays, and stagnant inventory into four-part explainable actions."
        actions={
          <button
            onClick={() => loadDecisions(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Decision Synthesis</span>
          </button>
        }
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}

      <Card className="p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                priorityFilter === p ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'ALL' ? `All Insights (${insights.length})` : `${p} Priority`}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          All decisions are computed directly from operational sales, inventory, and supplier records.
        </span>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No critical decisions required"
          description="Inventory coverage, supplier reliability, and sell-through rates are currently within normal thresholds."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <Card key={item.id} className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <StatusTag level={item.priority} label={`${item.priority} PRIORITY`} />
                  <h2 className="text-base font-semibold text-slate-900">{item.entity_name}</h2>
                  <span className="text-xs text-slate-400">· {item.entity_type}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">1. What is happening</h3>
                  <p className="text-slate-800 leading-relaxed">{item.what_is_happening}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">2. Why it is happening</h3>
                  <p className="text-slate-700 leading-relaxed">{item.why_it_happens}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">3. Possible business impact</h3>
                  <p className="text-slate-700 leading-relaxed">{item.business_impact}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#2563EB] mb-1">4. Recommended action</h3>
                  <p className="text-slate-900 font-medium leading-relaxed">{item.recommended_action}</p>
                </div>
              </div>

              {item.ai_narrative && (
                <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Executive Summary: </span>
                  {item.ai_narrative}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
