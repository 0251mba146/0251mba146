import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ApexDatabase, MarketingCampaign, MarketingChannel, UserRole } from '../shared/types.ts';
import { canEditModule, formatINR, formatPct, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { KpiCard, Modal, ReadOnlyBanner, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';

const CHANNELS: MarketingChannel[] = [
  'LinkedIn Sales Navigator',
  'Direct Email Campaigns',
  'CFO Networks',
  'Accounting Consultants',
  'B2B SaaS Communities',
];

export function MarketingModule({
  db,
  role,
  onMutate,
}: {
  db: ApexDatabase;
  role: UserRole;
  onMutate: (method: string, url: string, body?: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const editable = canEditModule(role, 'marketing');
  const [formOpen, setFormOpen] = useState(false);

  const [form, setForm] = useState<Omit<MarketingCampaign, 'id'>>({
    campaignName: '',
    channel: 'LinkedIn Sales Navigator',
    weekLabel: 'Week 4',
    budget: 25000,
    actualSpend: 15000,
    leadsGenerated: 20,
    demoBookings: 5,
    paidCustomers: 1,
    status: 'Active',
    ownerId: db.users.find((u) => u.role === 'SALES_MANAGER')?.id ?? 'USR-003',
  });

  const totalBudget = db.marketingCampaigns.reduce((s, c) => s + c.budget, 0);
  const totalSpend = db.marketingCampaigns.reduce((s, c) => s + c.actualSpend, 0);
  const totalLeads = db.marketingCampaigns.reduce((s, c) => s + c.leadsGenerated, 0);
  const totalDemos = db.marketingCampaigns.reduce((s, c) => s + c.demoBookings, 0);
  const totalPaid = db.marketingCampaigns.reduce((s, c) => s + c.paidCustomers, 0);
  const overallConv = totalLeads > 0 ? (totalPaid / totalLeads) * 100 : 0;
  const annualizedRevenue = totalPaid * db.assumptions.sellingPriceMonthly * 12;
  const overallRoi = totalSpend > 0 ? ((annualizedRevenue - totalSpend) / totalSpend) * 100 : 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/campaigns', form);
    if (res.ok) setFormOpen(false);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Marketing & 30-Day Go-To-Market Management"
        subtitle="Channel attribution, weekly GTM execution, demo bookings, and annualized campaign ROI · DEMO DATA"
        actions={
          editable ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Campaign
            </button>
          ) : null
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total GTM Spend / Budget" value={formatINR(totalSpend)} subtext={`Allocated budget: ${formatINR(totalBudget)}`} />
        <KpiCard label="Total Leads Generated" value={`${totalLeads}`} subtext={`${totalDemos} executive demos booked`} highlight="accent" />
        <KpiCard label="Paid Customers Acquired" value={`${totalPaid}`} subtext={`Cost per acquisition: ${formatINR(totalSpend / Math.max(totalPaid, 1))}`} highlight="positive" />
        <KpiCard label="Campaign Conversion Rate" value={formatPct(overallConv)} subtext="Leads to paid subscription" />
        <KpiCard label="Annualized GTM ROI" value={`${Math.round(overallRoi)}%`} subtext={`ARR attributed: ${formatINR(annualizedRevenue)}`} highlight="positive" />
      </div>

      {/* Channel Efficiency Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Channel Performance Comparison (5 GTM Pillars)</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {CHANNELS.map((ch) => {
            const list = db.marketingCampaigns.filter((c) => c.channel === ch);
            const leads = list.reduce((s, c) => s + c.leadsGenerated, 0);
            const paid = list.reduce((s, c) => s + c.paidCustomers, 0);
            const spend = list.reduce((s, c) => s + c.actualSpend, 0);
            return (
              <div key={ch} className="p-3 border border-slate-200 rounded-md space-y-1.5">
                <div className="text-xs font-semibold text-slate-900 leading-snug">{ch}</div>
                <div className="text-xs font-mono tabular-nums text-slate-600">{leads} leads · {paid} paid</div>
                <div className="text-xs font-mono tabular-nums text-blue-700 font-medium">
                  Spend: {formatINR(spend)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Campaign Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 text-left font-medium">ID</th>
                <th className="py-3 px-4 text-left font-medium">Campaign & Channel</th>
                <th className="py-3 px-4 text-left font-medium">GTM Window</th>
                <th className="py-3 px-4 text-right font-medium">Budget / Spend</th>
                <th className="py-3 px-4 text-right font-medium">Leads</th>
                <th className="py-3 px-4 text-right font-medium">Demos</th>
                <th className="py-3 px-4 text-right font-medium">Paid</th>
                <th className="py-3 px-4 text-right font-medium">Conv Rate</th>
                <th className="py-3 px-4 text-right font-medium">Annual ROI</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                {editable && <th className="py-3 px-4 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.marketingCampaigns.map((c) => {
                const conv = c.leadsGenerated > 0 ? (c.paidCustomers / c.leadsGenerated) * 100 : 0;
                const rev = c.paidCustomers * db.assumptions.sellingPriceMonthly * 12;
                const roi = c.actualSpend > 0 ? ((rev - c.actualSpend) / c.actualSpend) * 100 : 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">{c.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{c.campaignName}</div>
                      <div className="text-slate-500">{c.channel}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{c.weekLabel}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-medium text-slate-900">{formatINR(c.actualSpend)}</div>
                      <div className="text-slate-400">of {formatINR(c.budget)}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">{c.leadsGenerated}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{c.demoBookings}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">{c.paidCustomers}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{formatPct(conv)}</td>
                    <td className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${roi >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {Math.round(roi)}%
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SemanticStatus status={c.status} />
                    </td>
                    {editable && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onMutate('DELETE', `/api/campaigns/${c.id}`)}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50"
                          title="Delete Campaign"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Launch GTM Campaign">
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">Campaign Name *</label>
              <input
                required
                value={form.campaignName}
                onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value as MarketingChannel })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">GTM Week</label>
              <input
                value={form.weekLabel}
                onChange={(e) => setForm({ ...form, weekLabel: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Budget (₹)</label>
              <input
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Actual Spend (₹)</label>
              <input
                type="number"
                min={0}
                value={form.actualSpend}
                onChange={(e) => setForm({ ...form, actualSpend: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Leads Generated</label>
              <input
                type="number"
                min={0}
                value={form.leadsGenerated}
                onChange={(e) => setForm({ ...form, leadsGenerated: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Demo Bookings</label>
              <input
                type="number"
                min={0}
                value={form.demoBookings}
                onChange={(e) => setForm({ ...form, demoBookings: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Paid Customers</label>
              <input
                type="number"
                min={0}
                value={form.paidCustomers}
                onChange={(e) => setForm({ ...form, paidCustomers: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as MarketingCampaign['status'] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option>Active</option>
                <option>Planned</option>
                <option>Completed</option>
                <option>Paused</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md">
              Save Campaign
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
