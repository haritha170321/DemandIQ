import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { demandIqApi } from '../services/api';
import {
  Banner,
  Card,
  KpiCard,
  LoadingSkeleton,
  PageHeader,
  StatusTag,
} from '../components/ui';
import { ForecastResult, Product } from '../types';
import { formatNumber, getErrorMessage } from '../utils/format';

export default function ForecastingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30);
  const [modelPref, setModelPref] = useState<string>('');
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await demandIqApi.listProducts();
        setProducts(res.items);
        if (res.items.length > 0) {
          setSelectedProductId(res.items[0].id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load products for forecasting.'));
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const loadForecast = useCallback(async () => {
    if (!selectedProductId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await demandIqApi.getForecast(selectedProductId, horizon, modelPref || undefined);
      setForecast(res);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate demand forecast.'));
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, horizon, modelPref]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  const combinedChartData = useMemo(() => {
    if (!forecast) return [];
    const hist = forecast.historical_series.slice(-45).map((h) => ({
      date: h.date,
      actual: h.actual,
      predicted: null as number | null,
      range: null as [number, number] | null,
    }));
    const fut = forecast.forecast_series.map((f) => ({
      date: f.date,
      actual: null as number | null,
      predicted: f.predicted,
      range:
        f.lower_bound !== null && f.upper_bound !== null
          ? ([f.lower_bound, f.upper_bound] as [number, number])
          : null,
    }));
    return [...hist, ...fut];
  }, [forecast]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Demand Forecasting"
        subtitle="Time-series & ML regression forecasting evaluated on holdout MAE and RMSE with explainable trend attribution."
      />

      {error && <Banner type="error" message={error} onClose={() => setError(null)} />}

      {/* Controls */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Product SKU</label>
            <select
              value={selectedProductId ?? ''}
              onChange={(e) => {
                setSelectedProductId(Number(e.target.value));
                setModelPref('');
              }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[240px]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Forecast Horizon</label>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {([7, 30, 90] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    horizon === h ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {h} Days
                </button>
              ))}
            </div>
          </div>

          {forecast && forecast.model_comparisons.length > 0 && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Model Override</label>
              <select
                value={modelPref}
                onChange={(e) => setModelPref(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Auto-Select Best (Lowest RMSE)</option>
                {forecast.model_comparisons.map((m) => (
                  <option key={m.model_name} value={m.model_name}>
                    {m.model_name} (RMSE {m.rmse.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : forecast ? (
        <>
          {!forecast.sufficient_data && (
            <Banner
              type="info"
              message={`Insufficient Historical Data Notice: ${forecast.data_requirements} Currently using ${forecast.model_name}.`}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              label={`Predicted ${forecast.horizon_days}D Demand`}
              value={`${formatNumber(forecast.predicted_total_demand, 0)} units`}
              subtext={`${forecast.predicted_daily_demand.toFixed(2)} units / day`}
              tone="primary"
            />
            <KpiCard
              label="Current Stock on Hand"
              value={`${formatNumber(forecast.current_stock)} units`}
              subtext={forecast.current_stock < forecast.predicted_total_demand ? 'Below projected demand' : 'Covers forecast horizon'}
              tone={forecast.current_stock < forecast.predicted_total_demand ? 'warning' : 'success'}
            />
            <KpiCard
              label="Demand Trend"
              value={forecast.trend_direction}
              subtext={`${forecast.data_points_used} days evaluated`}
              tone={forecast.trend_direction === 'INCREASING' ? 'primary' : forecast.trend_direction === 'DECREASING' ? 'warning' : 'default'}
            />
            <KpiCard
              label="Holdout MAE"
              value={forecast.mae !== null ? forecast.mae.toFixed(2) : 'N/A'}
              subtext="Mean Absolute Error (units/day)"
            />
            <KpiCard
              label="Holdout RMSE"
              value={forecast.rmse !== null ? forecast.rmse.toFixed(2) : 'N/A'}
              subtext={forecast.model_name}
            />
          </div>

          {/* Main Forecast Chart */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Historical Sales vs {forecast.horizon_days}-Day Forecast · {forecast.product_name}
                </h2>
                <p className="text-xs text-slate-500">
                  Solid dark line: observed historical sales · Dashed blue line: projected demand
                  {forecast.supports_intervals ? ' · Shaded band: 90% prediction interval' : ''}
                </p>
              </div>
              <StatusTag level="NEUTRAL" label={forecast.model_name} />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combinedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip />
                  <Legend />
                  {forecast.supports_intervals && (
                    <Area
                      type="monotone"
                      dataKey="range"
                      stroke="none"
                      fill="#2563EB"
                      fillOpacity={0.12}
                      name="90% Prediction Interval"
                    />
                  )}
                  <Line type="monotone" dataKey="actual" stroke="#0F172A" strokeWidth={2} dot={false} name="Actual Historical Sales" connectNulls={false} />
                  <Line type="monotone" dataKey="predicted" stroke="#2563EB" strokeWidth={2.5} strokeDasharray="5 4" dot={false} name="Forecast Demand" connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Explainability & Factors */}
            <Card className="lg:col-span-5 p-5 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Forecast Explanation & Drivers</h2>
              <p className="text-sm text-slate-700 leading-relaxed">{forecast.explanation}</p>
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2">Key Influencing Factors</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {forecast.factors.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-[#2563EB] font-bold">·</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                Data Basis: {forecast.data_requirements}
              </div>
            </Card>

            {/* Holdout Backtest & Model Comparison */}
            <Card className="lg:col-span-7 p-5 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">Actual vs Predicted (Holdout Validation Window)</h2>
                <p className="text-xs text-slate-500 mb-3">Out-of-sample evaluation used to calculate real MAE and RMSE</p>
                {forecast.validation_series.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={forecast.validation_series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => String(v).slice(5)} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="actual" stroke="#0F172A" strokeWidth={2} name="Actual" />
                        <Line type="monotone" dataKey="predicted" stroke="#16A34A" strokeWidth={2} strokeDasharray="4 4" name="Predicted" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Validation chart requires at least 14 days of historical sales.</p>
                )}
              </div>

              {forecast.model_comparisons.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Model Evaluation Benchmark</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-y border-slate-200 text-slate-600">
                        <tr>
                          <th className="px-3 py-2">Model</th>
                          <th className="px-3 py-2 text-right">MAE</th>
                          <th className="px-3 py-2 text-right">RMSE</th>
                          <th className="px-3 py-2 text-right">Selection</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {forecast.model_comparisons.map((m) => (
                          <tr key={m.model_name}>
                            <td className="px-3 py-2 font-medium text-slate-800">{m.model_name}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.mae.toFixed(3)}</td>
                            <td className="px-3 py-2 text-right font-mono">{m.rmse.toFixed(3)}</td>
                            <td className="px-3 py-2 text-right">
                              {m.selected ? <StatusTag level="ACCEPTED" label="Selected" /> : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
