import axios from 'axios';
import { previewEngine } from './previewEngine';
import type {
  AlertItem,
  DashboardSummary,
  DecisionInsight,
  DiscountRecommendation,
  ForecastResult,
  InventoryAnalytics,
  InventoryItem,
  InventoryMovement,
  InventoryRisk,
  Product,
  ReorderPlanResponse,
  Sale,
  SalesAnalytics,
  Supplier,
  SupplierDelivery,
  SupplierRisk,
  User,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';

export function isPreviewSandboxMode(): boolean {
  return !API_BASE_URL;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: {
    'Content-Type': 'application/json',
  },
});

let bearerToken: string | null = null;

export function setAuthToken(token: string | null) {
  bearerToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

export function getAuthToken(): string | null {
  return bearerToken;
}

// Intercept only when running in Preview Sandbox Mode (no VITE_API_BASE_URL configured)
if (isPreviewSandboxMode()) {
  apiClient.interceptors.request.use((config) => {
    config.adapter = async (reqConfig) => {
      const url = reqConfig.url ?? '';
      const method = (reqConfig.method ?? 'get').toLowerCase();
      const body = typeof reqConfig.data === 'string' ? JSON.parse(reqConfig.data) : reqConfig.data;
      const params = reqConfig.params ?? {};

      let data: unknown;
      try {
        if (url === '/api/auth/login' && method === 'post') data = previewEngine.login(body.email, body.password);
        else if (url === '/api/auth/register' && method === 'post') data = previewEngine.register(body);
        else if (url === '/api/auth/me' && method === 'get') data = previewEngine.getMe();
        else if (url === '/api/auth/me' && method === 'put') data = previewEngine.updateMe(body);
        else if (url === '/api/products' && method === 'get') data = previewEngine.listProducts(params);
        else if (url === '/api/products' && method === 'post') data = previewEngine.createProduct(body);
        else if (url.startsWith('/api/products/') && method === 'put') data = previewEngine.updateProduct(Number(url.split('/').pop()), body);
        else if (url.startsWith('/api/products/') && method === 'delete') { previewEngine.deleteProduct(Number(url.split('/').pop())); data = null; }
        else if (url === '/api/suppliers/risks' && method === 'get') data = previewEngine.getSupplierRisks();
        else if (url === '/api/suppliers/deliveries' && method === 'post') data = previewEngine.logSupplierDelivery(body);
        else if (url.match(/^\/api\/suppliers\/\d+\/deliveries$/) && method === 'get') data = previewEngine.getSupplierDeliveries(Number(url.split('/')[3]));
        else if (url === '/api/suppliers' && method === 'get') data = previewEngine.listSuppliers(params.search);
        else if (url === '/api/suppliers' && method === 'post') data = previewEngine.createSupplier(body);
        else if (url.startsWith('/api/suppliers/') && method === 'put') data = previewEngine.updateSupplier(Number(url.split('/').pop()), body);
        else if (url.startsWith('/api/suppliers/') && method === 'delete') { previewEngine.deleteSupplier(Number(url.split('/').pop())); data = null; }
        else if (url === '/api/inventory' && method === 'get') data = previewEngine.getInventory();
        else if (url === '/api/inventory/movements' && method === 'post') data = previewEngine.createMovement(body);
        else if (url === '/api/inventory/movements' && method === 'get') data = previewEngine.listMovements(params);
        else if (url === '/api/sales' && method === 'get') data = previewEngine.listSales(params);
        else if (url === '/api/sales' && method === 'post') data = previewEngine.createSale(body);
        else if (url.startsWith('/api/forecast/') && method === 'get') {
          const pid = Number(url.split('/').pop());
          data = previewEngine.getForecast(pid, Number(params.horizon_days ?? 30), params.model_preference);
        }
        else if (url === '/api/risks' && method === 'get') data = previewEngine.getRisks(params.risk_level);
        else if (url === '/api/recommendations/reorder' && method === 'post') data = previewEngine.generateReorder(Number(body.budget));
        else if (url === '/api/recommendations/discount' && method === 'post') data = previewEngine.generateDiscounts(body.min_profit_margin_pct, body.slow_moving_days_threshold);
        else if (url === '/api/recommendations' && method === 'get') data = previewEngine.listRecommendations();
        else if (url.startsWith('/api/recommendations/reorder/') && method === 'patch') data = previewEngine.updateReorderStatus(Number(url.split('/').pop()), body.status);
        else if (url.startsWith('/api/recommendations/discount/') && method === 'patch') data = previewEngine.updateDiscountStatus(Number(url.split('/').pop()), body.status);
        else if (url === '/api/decisions' && method === 'get') data = previewEngine.getDecisions();
        else if (url === '/api/alerts/read-all' && method === 'patch') data = previewEngine.markAllAlertsRead();
        else if (url.match(/^\/api\/alerts\/\d+\/read$/) && method === 'patch') data = previewEngine.markAlertRead(Number(url.split('/')[3]));
        else if (url === '/api/alerts' && method === 'get') data = previewEngine.listAlerts(params);
        else if (url === '/api/dashboard/summary' && method === 'get') data = previewEngine.getDashboardSummary();
        else if (url === '/api/analytics/sales' && method === 'get') data = previewEngine.getSalesAnalytics();
        else if (url === '/api/analytics/inventory' && method === 'get') data = previewEngine.getInventoryAnalytics();
        else if (url === '/api/health' && method === 'get') data = { status: 'healthy', mode: 'preview-sandbox' };
        else throw new Error(`Unsupported preview route: ${method.toUpperCase()} ${url}`);

        return {
          data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: reqConfig,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Preview request failed';
        return Promise.reject({
          response: { status: 400, data: { detail: message } },
          message,
        });
      }
    };
    return config;
  });
}

export const demandIqApi = {
  getDashboardSummary: () => apiClient.get<DashboardSummary>('/api/dashboard/summary').then((r) => r.data),
  getSalesAnalytics: () => apiClient.get<SalesAnalytics>('/api/analytics/sales').then((r) => r.data),
  getInventoryAnalytics: () => apiClient.get<InventoryAnalytics>('/api/analytics/inventory').then((r) => r.data),

  listProducts: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<{ items: Product[]; total: number; categories: string[] }>('/api/products', { params }).then((r) => r.data),
  createProduct: (payload: Record<string, unknown>) => apiClient.post<Product>('/api/products', payload).then((r) => r.data),
  updateProduct: (id: number, payload: Record<string, unknown>) => apiClient.put<Product>(`/api/products/${id}`, payload).then((r) => r.data),
  deleteProduct: (id: number) => apiClient.delete(`/api/products/${id}`),

  listSuppliers: (search?: string) =>
    apiClient.get<Supplier[]>('/api/suppliers', { params: search ? { search } : undefined }).then((r) => r.data),
  createSupplier: (payload: Record<string, unknown>) => apiClient.post<Supplier>('/api/suppliers', payload).then((r) => r.data),
  updateSupplier: (id: number, payload: Record<string, unknown>) => apiClient.put<Supplier>(`/api/suppliers/${id}`, payload).then((r) => r.data),
  deleteSupplier: (id: number) => apiClient.delete(`/api/suppliers/${id}`),
  getSupplierDeliveries: (supplierId: number) =>
    apiClient.get<SupplierDelivery[]>(`/api/suppliers/${supplierId}/deliveries`).then((r) => r.data),
  logSupplierDelivery: (payload: Record<string, unknown>) =>
    apiClient.post<SupplierDelivery>('/api/suppliers/deliveries', payload).then((r) => r.data),
  getSupplierRisks: () => apiClient.get<{ items: SupplierRisk[] }>('/api/suppliers/risks').then((r) => r.data.items),

  getInventory: () =>
    apiClient
      .get<{
        summary: {
          total_skus: number;
          total_units: number;
          total_cost_valuation: number;
          total_retail_valuation: number;
          low_stock_count: number;
          out_of_stock_count: number;
        };
        items: InventoryItem[];
      }>('/api/inventory')
      .then((r) => r.data),
  createMovement: (payload: { product_id: number; movement_type: 'ADDITION' | 'REDUCTION' | 'ADJUSTMENT'; quantity: number; reason: string }) =>
    apiClient.post<InventoryMovement>('/api/inventory/movements', payload).then((r) => r.data),
  listMovements: (params?: { product_id?: number; movement_type?: string }) =>
    apiClient.get<{ items: InventoryMovement[] }>('/api/inventory/movements', { params }).then((r) => r.data.items),

  listSales: (params?: { product_id?: number; period?: string; start_date?: string; end_date?: string }) =>
    apiClient.get<{ items: Sale[]; summary: { count: number; total_revenue: number } }>('/api/sales', { params }).then((r) => r.data),
  createSale: (payload: { items: { product_id: number; quantity: number }[]; notes?: string }) =>
    apiClient.post<Sale>('/api/sales', payload).then((r) => r.data),

  getForecast: (productId: number, horizonDays: 7 | 30 | 90, modelPreference?: string) =>
    apiClient
      .get<ForecastResult>(`/api/forecast/${productId}`, {
        params: { horizon_days: horizonDays, model_preference: modelPreference || undefined },
      })
      .then((r) => r.data),

  getRisks: (riskLevel?: string) =>
    apiClient.get<{ items: InventoryRisk[] }>('/api/risks', { params: { risk_level: riskLevel } }).then((r) => r.data.items),

  generateReorder: (budget: number) =>
    apiClient.post<ReorderPlanResponse>('/api/recommendations/reorder', { budget }).then((r) => r.data),
  generateDiscounts: (payload: { min_profit_margin_pct?: number; slow_moving_days_threshold?: number }) =>
    apiClient.post<{ items: DiscountRecommendation[] }>('/api/recommendations/discount', payload).then((r) => r.data.items),
  listRecommendations: () =>
    apiClient
      .get<{ reorders: ReorderPlanResponse['recommendations']; discounts: DiscountRecommendation[] }>('/api/recommendations')
      .then((r) => r.data),
  updateReorderStatus: (id: number, status: 'ACCEPTED' | 'REJECTED') =>
    apiClient.patch(`/api/recommendations/reorder/${id}`, { status }).then((r) => r.data),
  updateDiscountStatus: (id: number, status: 'ACCEPTED' | 'REJECTED') =>
    apiClient.patch(`/api/recommendations/discount/${id}`, { status }).then((r) => r.data),

  getDecisions: (enhanceWithAi = false) =>
    apiClient.get<{ items: DecisionInsight[] }>('/api/decisions', { params: { enhance_with_ai: enhanceWithAi } }).then((r) => r.data.items),

  listAlerts: (params?: { severity?: string; category?: string; unread_only?: boolean }) =>
    apiClient.get<{ items: AlertItem[]; unread_count: number }>('/api/alerts', { params }).then((r) => r.data),
  markAlertRead: (id: number) => apiClient.patch(`/api/alerts/${id}/read`).then((r) => r.data),
  markAllAlertsRead: () => apiClient.patch('/api/alerts/read-all').then((r) => r.data),

  updateProfile: (payload: Partial<User>) => apiClient.put<User>('/api/auth/me', payload).then((r) => r.data),
};
