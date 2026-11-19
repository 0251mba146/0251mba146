import React, { useMemo, useState } from 'react';
import { Plus, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import type {
  ApexDatabase,
  BillingFrequency,
  PaymentStatus,
  PlanTier,
  SubscriptionRecord,
  SubscriptionStatus,
  UserRole,
} from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { canEditModule, formatINR, getPlanPrice, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { KpiCard, Modal, ReadOnlyBanner, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';

export function SubscriptionsModule({
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
  const editable = canEditModule(role, 'subscriptions');
  const [filter, setFilter] = useState<'ALL' | 'Active' | 'Expiring Soon' | 'Overdue' | 'Trial'>('ALL');
  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState<Omit<SubscriptionRecord, 'id'>>({
    customerId: db.customers[0]?.id ?? 'CUST-001',
    planName: 'Standard Plan',
    startDate: '2026-11-19',
    endDate: '2027-11-18',
    billingFrequency: 'Monthly',
    subscriptionAmount: db.assumptions.planPricing.standard,
    paymentStatus: 'Paid',
    renewalDate: '2026-12-19',
    status: 'Active',
  });

  const filtered = useMemo(() => {
    if (filter === 'ALL') return db.subscriptions;
    if (filter === 'Overdue') return db.subscriptions.filter((s) => s.paymentStatus === 'Overdue');
    return db.subscriptions.filter((s) => s.status === filter);
  }, [db.subscriptions, filter]);

  const { planPricing } = db.assumptions;
  const planCounts = {
    conservative: db.subscriptions.filter((s) => s.planName === 'Conservative Plan' && s.status !== 'Cancelled').length,
    standard: db.subscriptions.filter((s) => s.planName === 'Standard Plan' && s.status !== 'Cancelled').length,
    premium: db.subscriptions.filter((s) => s.planName === 'Premium Plan' && s.status !== 'Cancelled').length,
  };

  const getCustomerName = (id: string) => db.customers.find((c) => c.id === id)?.companyName ?? id;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/subscriptions', form);
    if (res.ok) setFormOpen(false);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Subscription & Recurring Revenue Management"
        subtitle="Track SaaS subscription tiers, renewals, billing cadence, and overdue collection alerts · DEMO DATA"
        actions={
          editable ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Subscription
            </button>
          ) : null
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Monthly Recurring Revenue" value={formatINR(metrics.live.mrr)} subtext={`ARR: ${formatINR(metrics.live.arr)}`} highlight="accent" />
        <KpiCard label="Active Subscriptions" value={`${metrics.live.activeSubscriptions}`} subtext={`${db.subscriptions.filter((s) => s.status === 'Trial').length} in 14-day trial`} highlight="positive" />
        <KpiCard label="Expiring Within 14 Days" value={`${metrics.live.expiringSubscriptions}`} subtext="Automated renewal alerts triggered" />
        <KpiCard
          label="Overdue Payments"
          value={`${metrics.live.overdueSubscriptions}`}
          subtext={metrics.live.overdueSubscriptions > 0 ? 'Action required by Finance' : 'All invoices current'}
          highlight={metrics.live.overdueSubscriptions > 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* Subscription Plans Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            name: 'Conservative Plan' as PlanTier,
            audience: 'For early-stage finance teams',
            price: planPricing.conservative,
            count: planCounts.conservative,
            limit: 'Core MIS, 3 ERP connectors, standard support',
          },
          {
            name: 'Standard Plan' as PlanTier,
            audience: 'Venture baseline · mid-market CFOs',
            price: planPricing.standard,
            count: planCounts.standard,
            limit: 'Full FP&A suite, unlimited dashboards, 15–20 hr/wk automation',
          },
          {
            name: 'Premium Plan' as PlanTier,
            audience: 'For multi-entity scaling operations',
            price: planPricing.premium,
            count: planCounts.premium,
            limit: 'Multi-entity consolidation, custom APIs, dedicated SLA',
          },
        ].map((tier) => (
          <div key={tier.name} className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{tier.name}</div>
                <div className="text-xs text-slate-500">{tier.audience}</div>
              </div>
              <div className="text-right">
                <div className="text-base font-mono tabular-nums font-semibold text-blue-700">
                  {formatINR(tier.price)}
                </div>
                <div className="text-[11px] text-slate-400">per month</div>
              </div>
            </div>
            <div className="text-xs text-slate-600 pt-1 border-t border-slate-100">{tier.limit}</div>
            <div className="text-xs font-mono tabular-nums text-slate-800 font-medium">
              {tier.count} active subscriptions · {formatINR(tier.count * tier.price)}/mo
            </div>
          </div>
        ))}
      </div>

      {/* Filter Segmented Control */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['ALL', 'Active', 'Expiring Soon', 'Overdue', 'Trial'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              filter === tab
                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab === 'ALL' ? `All (${db.subscriptions.length})` : tab}
          </button>
        ))}
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Sub ID</th>
                <th className="py-3 px-4 text-left font-medium">Customer</th>
                <th className="py-3 px-4 text-left font-medium">Plan</th>
                <th className="py-3 px-4 text-left font-medium">Billing</th>
                <th className="py-3 px-4 text-right font-medium">Amount</th>
                <th className="py-3 px-4 text-left font-medium">Start / Renewal</th>
                <th className="py-3 px-4 text-left font-medium">Payment</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                {editable && <th className="py-3 px-4 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">{sub.id}</td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {getCustomerName(sub.customerId)}
                    <div className="text-[11px] font-mono text-slate-400">{sub.customerId}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{sub.planName}</td>
                  <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{sub.billingFrequency}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {formatINR(sub.subscriptionAmount)}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                    {sub.startDate} → {sub.renewalDate}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <SemanticStatus status={sub.paymentStatus} />
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <SemanticStatus status={sub.status} />
                  </td>
                  {editable && (
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {sub.paymentStatus !== 'Paid' && (
                          <button
                            type="button"
                            onClick={() =>
                              onMutate('PUT', `/api/subscriptions/${sub.id}`, {
                                paymentStatus: 'Paid',
                                status: 'Active',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Mark Paid
                          </button>
                        )}
                        {sub.paymentStatus === 'Paid' && sub.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() =>
                              onMutate('PUT', `/api/subscriptions/${sub.id}`, {
                                paymentStatus: 'Overdue',
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-amber-700 border border-amber-200 rounded hover:bg-amber-50"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Flag Overdue
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onMutate('DELETE', `/api/subscriptions/${sub.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50"
                          title="Delete Subscription"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Create Subscription">
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Customer *</label>
              <select
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {db.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName} ({c.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Plan Tier *</label>
              <select
                value={form.planName}
                onChange={(e) => {
                  const p = e.target.value as PlanTier;
                  setForm({
                    ...form,
                    planName: p,
                    subscriptionAmount: getPlanPrice(p, db.assumptions.planPricing),
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="Conservative Plan">Conservative Plan</option>
                <option value="Standard Plan">Standard Plan</option>
                <option value="Premium Plan">Premium Plan</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Billing Frequency</label>
              <select
                value={form.billingFrequency}
                onChange={(e) => setForm({ ...form, billingFrequency: e.target.value as BillingFrequency })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Subscription Amount (₹)</label>
              <input
                type="number"
                min={0}
                value={form.subscriptionAmount}
                onChange={(e) => setForm({ ...form, subscriptionAmount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Renewal Date</label>
              <input
                type="date"
                value={form.renewalDate}
                onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Payment Status</label>
              <select
                value={form.paymentStatus}
                onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as PaymentStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Subscription Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as SubscriptionStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="Active">Active</option>
                <option value="Trial">Trial</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md"
            >
              Save Subscription
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
