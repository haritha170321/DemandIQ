import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  BrainCircuit,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Percent,
  Search,
  Settings,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demandIqApi } from '../services/api';
import { AlertItem } from '../types';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/suppliers', label: 'Suppliers', icon: Users },
  { path: '/inventory', label: 'Inventory', icon: Boxes },
  { path: '/sales', label: 'Sales', icon: ShoppingCart },
  { path: '/forecasting', label: 'Demand Forecasting', icon: TrendingUp },
  { path: '/stockout-risk', label: 'Stockout Risk', icon: ShieldAlert },
  { path: '/reorder-intelligence', label: 'Reorder Intelligence', icon: SlidersHorizontal },
  { path: '/discounts', label: 'Discount Recommendations', icon: Percent },
  { path: '/decision-center', label: 'AI Decision Center', icon: BrainCircuit },
  { path: '/supplier-intelligence', label: 'Supplier Intelligence', icon: Truck },
  { path: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  const { user, logout, isPreviewMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const currentNav = useMemo(
    () => NAV_ITEMS.find((item) => item.path === location.pathname) ?? NAV_ITEMS[0],
    [location.pathname],
  );

  useEffect(() => {
    let active = true;
    async function loadAlerts() {
      try {
        const res = await demandIqApi.listAlerts({ unread_only: false });
        if (active) {
          setAlerts(res.items.slice(0, 5));
          setUnreadCount(res.unread_count);
        }
      } catch {
        // ignore header poll errors
      }
    }
    loadAlerts();
    return () => {
      active = false;
    };
  }, [location.pathname]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/products?search=${encodeURIComponent(q)}`);
    setMobileOpen(false);
  }

  async function handleQuickRead(id: number) {
    await demandIqApi.markAlertRead(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-300">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800 shrink-0">
        <Link to="/" className="flex items-center gap-2.5 text-white font-display font-bold text-lg tracking-tight whitespace-nowrap">
          <span className="w-7 h-7 rounded-lg bg-[#2563EB] flex items-center justify-center text-white text-sm font-bold">
            DQ
          </span>
          <span>DemandIQ</span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.path === '/alerts' && unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[11px] font-mono rounded bg-red-600 text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="text-xs text-slate-400 mb-3">
          <div className="font-medium text-slate-200 truncate">{user?.business_name}</div>
          <div className="truncate mt-0.5">{isPreviewMode ? 'Demo Dataset Sandbox' : 'Connected to FastAPI'}</div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-800 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-68 max-w-[85vw] h-full shadow-xl">{SidebarContent}</div>
          <div className="flex-1 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm text-slate-500 min-w-0">
              <Link to="/" className="hover:text-slate-900 whitespace-nowrap">
                DemandIQ
              </Link>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-900 truncate">{currentNav.label}</span>
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <form onSubmit={handleSearchSubmit} className="relative hidden md:block">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products or SKU..."
                className="w-64 pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </form>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Open notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-mono flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">Active Alerts</span>
                    <Link
                      to="/alerts"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs font-medium text-[#2563EB] hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {alerts.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 text-center">No active alerts.</div>
                    ) : (
                      alerts.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handleQuickRead(a.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                            a.is_read ? 'opacity-65' : 'bg-blue-50/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500 mb-1">
                            <span>{a.category.replace(/_/g, ' ')}</span>
                            <span className={a.severity === 'HIGH' ? 'text-[#DC2626]' : 'text-[#D97706]'}>
                              {a.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed">{a.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <Link
              to="/settings"
              className="flex items-center pl-3 border-l border-slate-200 hover:opacity-80 transition-opacity"
            >
              <div className="text-left leading-tight">
                <div className="text-sm font-medium text-slate-900 max-w-[140px] truncate">
                  {user?.full_name ?? 'User'}
                </div>
                <div className="text-xs text-slate-500 max-w-[140px] truncate">{user?.email}</div>
              </div>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
