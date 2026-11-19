import React, { useMemo, useState } from 'react';
import { Plus, UserCheck, Edit2, Trash2 } from 'lucide-react';
import type { ApexDatabase, DemoStatus, LeadRecord, SalesStage, UserRole } from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { canEditModule, formatINR, formatPct, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { KpiCard, Modal, ReadOnlyBanner, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';

const SALES_STAGES: SalesStage[] = [
  'New Lead',
  'Contacted',
  'Interested',
  'Demo Scheduled',
  'Demo Completed',
  'Trial Started',
  'Negotiation',
  'Converted',
  'Lost',
];

const DEMO_STATUSES: DemoStatus[] = ['Not Scheduled', 'Scheduled', 'Completed', 'Rescheduled', 'Cancelled'];

export function SalesPipelineModule({
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
  const editable = canEditModule(role, 'pipeline');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'stages'>('table');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState<Omit<LeadRecord, 'id'>>({
    companyName: '',
    contactPerson: '',
    jobDesignation: 'Chief Financial Officer',
    email: '',
    leadSource: 'LinkedIn Sales Navigator',
    expectedDealValue: 300000,
    salesStage: 'New Lead',
    followUpDate: '2026-11-22',
    demoStatus: 'Not Scheduled',
    conversionProbability: 25,
    assignedEmployeeId: db.users.find((u) => u.role === 'SALES_MANAGER')?.id ?? 'USR-003',
    notes: '',
  });

  const filteredLeads = useMemo(() => {
    if (stageFilter === 'ALL') return db.leads;
    return db.leads.filter((l) => l.salesStage === stageFilter);
  }, [db.leads, stageFilter]);

  function openNew() {
    setEditing(null);
    setActionError(null);
    setForm({
      companyName: '',
      contactPerson: '',
      jobDesignation: 'Chief Financial Officer',
      email: '',
      leadSource: 'LinkedIn Sales Navigator',
      expectedDealValue: 300000,
      salesStage: 'New Lead',
      followUpDate: '2026-11-22',
      demoStatus: 'Not Scheduled',
      conversionProbability: 25,
      assignedEmployeeId: db.users.find((u) => u.role === 'SALES_MANAGER')?.id ?? 'USR-003',
      notes: '',
    });
    setFormOpen(true);
  }

  function openEdit(lead: LeadRecord) {
    setEditing(lead);
    setActionError(null);
    const { id: _id, ...rest } = lead;
    setForm(rest);
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const res = editing
      ? await onMutate('PUT', `/api/leads/${editing.id}`, form)
      : await onMutate('POST', '/api/leads', form);
    if (!res.ok) {
      setActionError(res.error || 'Failed to save lead.');
      return;
    }
    setFormOpen(false);
  }

  async function handleConvert(leadId: string) {
    setActionError(null);
    const res = await onMutate('POST', `/api/leads/${leadId}/convert`);
    if (!res.ok) {
      setActionError(res.error || 'Could not convert lead.');
    }
  }

  const getUserName = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sales & Lead Pipeline"
        subtitle="9-stage B2B enterprise sales pipeline from outreach to paid pilot conversion · DEMO DATA"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-md">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('stages')}
                className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'stages' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                Stage Funnel
              </button>
            </div>
            {editable && (
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add Lead
              </button>
            )}
          </div>
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
          {actionError}
        </div>
      )}

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Leads" value={`${metrics.live.totalLeads}`} subtext="Active + historical pipeline" />
        <KpiCard label="Qualified Leads" value={`${metrics.live.qualifiedLeads}`} subtext="Past initial contact stage" highlight="accent" />
        <KpiCard label="Upcoming Follow-ups" value={`${metrics.live.upcomingFollowUps}`} subtext="Scheduled from today forward" />
        <KpiCard label="Demo Conversion Rate" value={formatPct(metrics.live.demoConversionRatePct)} subtext="Demos completed vs scheduled" highlight="positive" />
        <KpiCard label="Lead-to-Customer Rate" value={formatPct(metrics.live.leadToCustomerConversionPct)} subtext="Closed won conversion" />
        <KpiCard label="Expected Sales Revenue" value={formatINR(metrics.live.expectedSalesRevenue)} subtext="Probability-weighted ARR" highlight="positive" />
      </div>

      {/* Stage Filter Strip */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => setStageFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            stageFilter === 'ALL'
              ? 'bg-[#0B192C] text-white border-[#0B192C]'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Stages ({db.leads.length})
        </button>
        {SALES_STAGES.map((stage) => {
          const count = db.leads.filter((l) => l.salesStage === stage).length;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setStageFilter(stage)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                stageFilter === stage
                  ? 'bg-[#0B192C] text-white border-[#0B192C]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {stage} ({count})
            </button>
          );
        })}
      </div>

      {viewMode === 'stages' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {SALES_STAGES.map((stage) => {
            const items = db.leads.filter((l) => l.salesStage === stage);
            const stageVal = items.reduce((s, l) => s + l.expectedDealValue, 0);
            return (
              <div key={stage} className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-semibold text-slate-900">{stage}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">{items.length}</span>
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                  Value: {formatINR(stageVal)}
                </div>
                <div className="space-y-2">
                  {items.map((l) => (
                    <div key={l.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-md space-y-1 text-xs">
                      <div className="font-semibold text-slate-900 leading-snug">{l.companyName}</div>
                      <div className="text-slate-600">{l.contactPerson} · {l.jobDesignation}</div>
                      <div className="flex items-center justify-between font-mono tabular-nums text-[11px] text-slate-700 pt-1">
                        <span>{formatINR(l.expectedDealValue)}</span>
                        <span>{l.conversionProbability}%</span>
                      </div>
                      {editable && !l.convertedCustomerId && l.salesStage !== 'Lost' && (
                        <button
                          type="button"
                          onClick={() => handleConvert(l.id)}
                          className="w-full mt-1.5 py-1 text-[11px] font-medium text-emerald-700 bg-white border border-emerald-200 rounded hover:bg-emerald-50"
                        >
                          Convert to Customer
                        </button>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <div className="text-[11px] text-slate-400">No leads in stage</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Lead ID</th>
                  <th className="py-3 px-4 text-left font-medium">Company & Contact</th>
                  <th className="py-3 px-4 text-left font-medium">Source</th>
                  <th className="py-3 px-4 text-left font-medium">Sales Stage</th>
                  <th className="py-3 px-4 text-left font-medium">Demo Status</th>
                  <th className="py-3 px-4 text-right font-medium">Expected ARR</th>
                  <th className="py-3 px-4 text-right font-medium">Prob %</th>
                  <th className="py-3 px-4 text-left font-medium">Follow-up</th>
                  <th className="py-3 px-4 text-left font-medium">Owner</th>
                  <th className="py-3 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">{l.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{l.companyName}</div>
                      <div className="text-slate-500">{l.contactPerson} · {l.jobDesignation}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{l.leadSource}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SemanticStatus status={l.salesStage} />
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{l.demoStatus}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatINR(l.expectedDealValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {l.conversionProbability}%
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">{l.followUpDate}</td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{getUserName(l.assignedEmployeeId)}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {editable && !l.convertedCustomerId && l.salesStage !== 'Lost' && (
                          <button
                            type="button"
                            onClick={() => handleConvert(l.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50"
                            title="Convert lead to Paid Customer + Subscription"
                          >
                            <UserCheck className="w-3 h-3" />
                            Convert
                          </button>
                        )}
                        {editable && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(l)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                              title="Edit Lead"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMutate('DELETE', `/api/leads/${l.id}`)}
                              className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Lead (${editing.id})` : 'Add Sales Lead'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Company Name *</label>
              <input
                required
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Contact Person *</label>
              <input
                required
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Job Designation *</label>
              <input
                required
                value={form.jobDesignation}
                onChange={(e) => setForm({ ...form, jobDesignation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Lead Source</label>
              <select
                value={form.leadSource}
                onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option>LinkedIn Sales Navigator</option>
                <option>Direct Email Campaigns</option>
                <option>CFO Networks</option>
                <option>Accounting Consultants</option>
                <option>B2B SaaS Communities</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Expected Deal Value (₹ Annual)</label>
              <input
                type="number"
                min={0}
                value={form.expectedDealValue}
                onChange={(e) => setForm({ ...form, expectedDealValue: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Sales Stage</label>
              <select
                value={form.salesStage}
                onChange={(e) => setForm({ ...form, salesStage: e.target.value as SalesStage })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {SALES_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Demo Status</label>
              <select
                value={form.demoStatus}
                onChange={(e) => setForm({ ...form, demoStatus: e.target.value as DemoStatus })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {DEMO_STATUSES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Conversion Probability (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.conversionProbability}
                onChange={(e) => setForm({ ...form, conversionProbability: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Follow-up Date</label>
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Assigned Employee</label>
              <select
                value={form.assignedEmployeeId}
                onChange={(e) => setForm({ ...form, assignedEmployeeId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {db.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
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
              Save Lead
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
