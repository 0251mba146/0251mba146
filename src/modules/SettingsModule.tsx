import React, { useState } from 'react';
import { RefreshCw, RotateCcw, Plus } from 'lucide-react';
import type { ApexDatabase, UserRecord, UserRole, VentureAssumptions } from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { canEditModule, formatINR, formatPct, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { Modal, ReadOnlyBanner, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';

export function SettingsModule({
  db,
  metrics,
  role,
  onMutate,
}: {
  db: ApexDatabase;
  metrics: ComputedMetrics;
  role: UserRole;
  onMutate: (method: string, url: string, body?: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const editable = canEditModule(role, 'settings');
  const [assumptions, setAssumptions] = useState<VentureAssumptions>(db.assumptions);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [userModal, setUserModal] = useState(false);

  const [newUser, setNewUser] = useState<Omit<UserRecord, 'id' | 'avatarUrl' | 'lastLogin'>>({
    name: '',
    email: '',
    role: 'FINANCE_MANAGER',
    designation: 'Senior Financial Analyst',
    city: 'Bengaluru',
    status: 'Active',
  });

  async function saveAssumptions(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg(null);
    const res = await onMutate('PUT', '/api/assumptions', assumptions);
    if (res.ok) setSavedMsg('Venture financial assumptions updated across all dashboards and formulas.');
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/users', newUser);
    if (res.ok) {
      setUserModal(false);
      setNewUser({
        name: '',
        email: '',
        role: 'FINANCE_MANAGER',
        designation: 'Senior Financial Analyst',
        city: 'Bengaluru',
        status: 'Active',
      });
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Platform Settings, Financial Assumptions & RBAC"
        subtitle="Administer venture unit economics parameters, role-based access control, and automated workflow triggers · DEMO DATA"
        actions={
          editable ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onMutate('POST', '/api/automation/run')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Run Automation Sweep
              </button>
              <button
                type="button"
                onClick={() => onMutate('POST', '/api/reset-demo')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 bg-white border border-red-200 rounded-md hover:bg-red-50 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Demo Dataset
              </button>
            </div>
          ) : null
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      {savedMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
          {savedMsg}
        </div>
      )}

      {/* Financial Assumptions Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={saveAssumptions} className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Venture Base Financial Assumptions</h2>
            <p className="text-xs text-slate-500">Modifying these parameters recalculates break-even, contribution margin, and pricing across the platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Standard Selling Price (₹ / month)</label>
              <input
                type="number"
                disabled={!editable}
                value={assumptions.sellingPriceMonthly}
                onChange={(e) => setAssumptions({ ...assumptions, sellingPriceMonthly: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Variable Cost / Customer (₹ / month)</label>
              <input
                type="number"
                disabled={!editable}
                value={assumptions.variableCostPerCustomer}
                onChange={(e) => setAssumptions({ ...assumptions, variableCostPerCustomer: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Expected Base Customers</label>
              <input
                type="number"
                disabled={!editable}
                value={assumptions.expectedBaseCustomers}
                onChange={(e) => setAssumptions({ ...assumptions, expectedBaseCustomers: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Monthly Fixed Cost (₹)</label>
              <input
                type="number"
                disabled={!editable}
                value={assumptions.monthlyFixedCost}
                onChange={(e) => setAssumptions({ ...assumptions, monthlyFixedCost: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Conservative Plan Price (₹)</label>
              <input
                type="number"
                disabled={!editable}
                value={assumptions.planPricing.conservative}
                onChange={(e) =>
                  setAssumptions({
                    ...assumptions,
                    planPricing: { ...assumptions.planPricing, conservative: Number(e.target.value) },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Premium Plan Price (₹)</label>
              <input
                type="number"
                disabled={!editable}
                value={assumptions.planPricing.premium}
                onChange={(e) =>
                  setAssumptions({
                    ...assumptions,
                    planPricing: { ...assumptions.planPricing, premium: Number(e.target.value) },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-50"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Renewal Alert Window (Days)</label>
              <input
                type="number"
                disabled={!editable}
                value={assumptions.automationThresholds.renewalReminderDays}
                onChange={(e) =>
                  setAssumptions({
                    ...assumptions,
                    automationThresholds: {
                      ...assumptions.automationThresholds,
                      renewalReminderDays: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono disabled:bg-slate-50"
              />
            </div>
          </div>
          {editable && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844]"
              >
                Save Financial Assumptions
              </button>
            </div>
          )}
        </form>

        {/* Live Calculated Preview */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-3 text-xs">
          <h2 className="text-sm font-semibold text-slate-900">Calculated Venture Plan Output</h2>
          <div className="divide-y divide-slate-100">
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Expected Monthly Revenue</span>
              <span className="font-mono font-semibold">{formatINR(metrics.benchmark.expectedMonthlyRevenue)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Total Monthly Variable Cost</span>
              <span className="font-mono">{formatINR(metrics.benchmark.totalVariableCost)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Total Monthly Operating Cost</span>
              <span className="font-mono font-medium">{formatINR(metrics.benchmark.totalMonthlyOperatingCost)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Expected Operating Surplus</span>
              <span className="font-mono font-semibold text-emerald-700">{formatINR(metrics.benchmark.expectedOperatingSurplus)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Contribution Per Customer</span>
              <span className="font-mono font-semibold text-blue-700">{formatINR(metrics.benchmark.contributionPerCustomer)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Contribution Margin</span>
              <span className="font-mono font-semibold text-emerald-700">{formatPct(metrics.benchmark.contributionMarginPct)}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Break-Even Customers</span>
              <span className="font-mono font-semibold text-slate-900">~{metrics.benchmark.breakEvenCustomersCeil} ({metrics.benchmark.breakEvenCustomersExact.toFixed(2)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Access Control Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Team Directory & Role-Based Access Control (RBAC)</h2>
            <p className="text-xs text-slate-500">Server-verified permissions across Admin, Finance Manager, Sales Manager, and Executive roles</p>
          </div>
          {editable && (
            <button
              type="button"
              onClick={() => setUserModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0B192C] rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Add User
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 text-left font-medium">User</th>
                <th className="py-3 px-4 text-left font-medium">Role</th>
                <th className="py-3 px-4 text-left font-medium">City</th>
                <th className="py-3 px-4 text-left font-medium">Permissions Scope</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={u.avatarUrl}
                        alt={u.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100"
                      />
                      <div>
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-slate-500">{u.designation} · {u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">{u.role}</td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{u.city}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-sm">{ROLE_PERMISSIONS[u.role].description}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <SemanticStatus status={u.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={userModal} onClose={() => setUserModal(false)} title="Provision Team Member">
        <form onSubmit={addUser} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Full Name *</label>
              <input required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Role</label>
              <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white">
                <option value="ADMIN">ADMIN</option>
                <option value="FINANCE_MANAGER">FINANCE_MANAGER</option>
                <option value="SALES_MANAGER">SALES_MANAGER</option>
                <option value="EXECUTIVE">EXECUTIVE</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Designation</label>
              <input value={newUser.designation} onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">City</label>
              <input value={newUser.city} onChange={(e) => setNewUser({ ...newUser, city: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setUserModal(false)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md">
              Create User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
