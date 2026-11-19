import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  CreditCard,
  FileSpreadsheet,
  Globe2,
  LayoutDashboard,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { ApexDatabase, ModuleKey, UserRecord } from './shared/types.ts';
import type { ComputedMetrics } from './shared/financialUtils.ts';
import { canViewModule, ROLE_PERMISSIONS } from './shared/financialUtils.ts';
import { Modal } from './components/UiPrimitives.tsx';
import { ExecutiveDashboard } from './modules/ExecutiveDashboard.tsx';
import { CustomersModule } from './modules/CustomersModule.tsx';
import { SalesPipelineModule } from './modules/SalesPipelineModule.tsx';
import { SubscriptionsModule } from './modules/SubscriptionsModule.tsx';
import { FinancialManagementModule } from './modules/FinancialManagementModule.tsx';
import { BusinessAnalyticsModule } from './modules/BusinessAnalyticsModule.tsx';
import { MarketingModule } from './modules/MarketingModule.tsx';
import { VentureValidationModule } from './modules/VentureValidationModule.tsx';
import { MarketAnalysisModule } from './modules/MarketAnalysisModule.tsx';
import { ReportsModule } from './modules/ReportsModule.tsx';
import { SettingsModule } from './modules/SettingsModule.tsx';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'pipeline', label: 'Sales Pipeline', icon: TrendingUp },
  { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { key: 'financials', label: 'Financial Management', icon: Building2 },
  { key: 'analytics', label: 'Business Analytics', icon: BarChart3 },
  { key: 'marketing', label: 'Marketing', icon: Megaphone },
  { key: 'validation', label: 'Venture Validation', icon: CheckSquare },
  { key: 'market', label: 'Market Analysis', icon: Globe2 },
  { key: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [db, setDb] = useState<ApexDatabase | null>(null);
  const [metrics, setMetrics] = useState<ComputedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [currentUserId, setCurrentUserId] = useState<string>('USR-001');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDb(data.db);
      setMetrics(data.metrics);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load Apex Tech platform.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const currentUser: UserRecord | undefined =
    db?.users.find((u) => u.id === currentUserId) ?? db?.users[0];
  const currentRole = currentUser?.role ?? 'ADMIN';

  const handleMutate = useCallback(
    async (method: string, url: string, body?: unknown): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': currentRole,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data.error || `Request failed (${res.status})` };
        }
        if (data.db) setDb(data.db);
        if (data.metrics) setMetrics(data.metrics);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
      }
    },
    [currentRole]
  );

  // Ensure activeModule remains visible when switching roles
  useEffect(() => {
    if (!canViewModule(currentRole, activeModule)) {
      setActiveModule('dashboard');
    }
  }, [currentRole, activeModule]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl space-y-4">
          <div className="h-10 bg-slate-200 rounded animate-pulse w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-white border border-slate-200 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-72 bg-white border border-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError || !db || !metrics || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-red-200 rounded-lg p-6 max-w-md text-center space-y-3">
          <div className="text-sm font-semibold text-red-700">Unable to load Apex Tech Platform</div>
          <p className="text-xs text-slate-600">{loadError || 'Database initialization error.'}</p>
          <button
            type="button"
            onClick={loadBootstrap}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter((item) => canViewModule(currentRole, item.key));
  const unreadCount = db.notifications.filter((n) => !n.read).length;
  const activeNavLabel = NAV_ITEMS.find((n) => n.key === activeModule)?.label ?? 'Executive Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B192C] text-white border-r border-slate-800 z-30">
        <div className="h-16 px-5 flex items-center border-b border-white/10">
          <div>
            <div className="text-base font-semibold tracking-tight text-white">Apex Tech</div>
            <div className="text-[11px] text-slate-400">Financial Intelligence</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveModule(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setRoleModalOpen(true)}
            className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-white/10 text-left transition-colors"
          >
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover border border-white/20 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{currentUser.name}</div>
              <div className="text-[11px] text-slate-400 truncate">{ROLE_PERMISSIONS[currentRole].label}</div>
            </div>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-64 max-w-full bg-[#0B192C] text-white flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <span className="text-base font-semibold">Apex Tech</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeModule === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-md whitespace-nowrap ${
                      isActive ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on left, concise utility controls on right */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="font-medium text-slate-900 whitespace-nowrap">Apex Global Technologies</span>
              <span aria-hidden="true">/</span>
              <span className="text-slate-700 font-medium truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5 text-slate-600" />
              <span>Alerts</span>
              {unreadCount > 0 && (
                <span className="font-mono tabular-nums text-red-700 font-semibold">({unreadCount})</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setRoleModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{ROLE_PERMISSIONS[currentRole].label}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeModule === 'dashboard' && (
            <ExecutiveDashboard db={db} metrics={metrics} onNavigate={setActiveModule} />
          )}
          {activeModule === 'customers' && (
            <CustomersModule db={db} role={currentRole} onMutate={handleMutate} />
          )}
          {activeModule === 'pipeline' && (
            <SalesPipelineModule db={db} metrics={metrics} role={currentRole} onMutate={handleMutate} />
          )}
          {activeModule === 'subscriptions' && (
            <SubscriptionsModule db={db} metrics={metrics} role={currentRole} onMutate={handleMutate} />
          )}
          {activeModule === 'financials' && (
            <FinancialManagementModule db={db} metrics={metrics} role={currentRole} onMutate={handleMutate} />
          )}
          {activeModule === 'analytics' && (
            <BusinessAnalyticsModule db={db} metrics={metrics} />
          )}
          {activeModule === 'marketing' && (
            <MarketingModule db={db} role={currentRole} onMutate={handleMutate} />
          )}
          {activeModule === 'validation' && (
            <VentureValidationModule db={db} role={currentRole} onMutate={handleMutate} />
          )}
          {activeModule === 'market' && (
            <MarketAnalysisModule db={db} metrics={metrics} />
          )}
          {activeModule === 'reports' && (
            <ReportsModule
              db={db}
              metrics={metrics}
              role={currentRole}
              currentUserId={currentUser.id}
              onMutate={handleMutate}
            />
          )}
          {activeModule === 'settings' && (
            <SettingsModule db={db} metrics={metrics} role={currentRole} onMutate={handleMutate} />
          )}
        </main>
      </div>

      {/* Role Switcher / RBAC Sign-In Modal */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title="Role-Based Access Control (Switch Session)"
        subtitle="Select an authenticated user profile to test permission boundaries across modules and API endpoints."
        maxWidth="max-w-xl"
      >
        <div className="space-y-3">
          {db.users.map((u) => {
            const selected = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setCurrentUserId(u.id);
                  setRoleModalOpen(false);
                }}
                className={`w-full text-left p-3.5 rounded-lg border transition-colors flex items-center gap-3.5 ${
                  selected
                    ? 'border-blue-700 bg-blue-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <img
                  src={u.avatarUrl}
                  alt={u.name}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">{u.name}</span>
                    <span className="text-[11px] font-mono font-medium text-blue-700">
                      {u.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600">{u.designation} · {u.city}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{ROLE_PERMISSIONS[u.role].description}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Workflow Notifications Modal */}
      <Modal
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        title="Automated Workflow Notifications"
        subtitle="Alerts generated by subscription renewal checks, overdue invoices, sales follow-ups, and validation deadlines."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => handleMutate('POST', '/api/automation/run')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844]"
            >
              Run Automation Check Now
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => handleMutate('POST', '/api/notifications/read-all')}
                className="text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
            {db.notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 text-xs flex items-start justify-between gap-4 ${
                  n.read ? 'bg-white' : 'bg-slate-50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`font-semibold ${
                        n.severity === 'critical'
                          ? 'text-red-700'
                          : n.severity === 'warning'
                          ? 'text-amber-700'
                          : n.severity === 'success'
                          ? 'text-emerald-700'
                          : 'text-blue-700'
                      }`}
                    >
                      {n.type}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-400">{n.relatedId}</span>
                  </div>
                  <div className="font-semibold text-slate-900">{n.title}</div>
                  <div className="text-slate-600">{n.message}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModule(n.module as ModuleKey);
                      setNotifOpen(false);
                    }}
                    className="text-[11px] font-medium text-blue-700 hover:underline whitespace-nowrap"
                  >
                    Open Module
                  </button>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => handleMutate('POST', `/api/notifications/${n.id}/read`)}
                      className="text-[11px] text-slate-500 hover:text-slate-800"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
