import React, { useMemo, useState } from 'react';
import { Plus, Search, Eye, Edit2, Trash2 } from 'lucide-react';
import type { ApexDatabase, CustomerRecord, CustomerStatus, PlanTier, UserRole } from '../shared/types.ts';
import { canEditModule, formatINR, getPlanPrice, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { EmptyState, KpiCard, Modal, ReadOnlyBanner, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';

const CUSTOMER_STATUSES: CustomerStatus[] = [
  'Prospect',
  'Qualified Lead',
  'Demo Scheduled',
  'Trial Customer',
  'Paid Customer',
  'Inactive Customer',
];

const PLANS: PlanTier[] = ['Conservative Plan', 'Standard Plan', 'Premium Plan'];
const CITIES = ['Bengaluru', 'Mumbai', 'Delhi-NCR', 'US-Expansion', 'Hyderabad', 'Pune'];
const LEAD_SOURCES = [
  'LinkedIn Sales Navigator',
  'Direct Email Campaigns',
  'CFO Networks',
  'Accounting Consultants',
  'B2B SaaS Communities',
];

export function CustomersModule({
  db,
  role,
  onMutate,
}: {
  db: ApexDatabase;
  role: UserRole;
  onMutate: (method: string, url: string, body?: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const editable = canEditModule(role, 'customers');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState<Omit<CustomerRecord, 'id'>>({
    companyName: '',
    contactPerson: '',
    designation: 'Chief Financial Officer',
    email: '',
    phone: '+91 ',
    industry: 'B2B SaaS',
    companyRevenueRange: '₹50 Cr – ₹150 Cr',
    employeeCount: 120,
    city: 'Bengaluru',
    leadSource: 'LinkedIn Sales Navigator',
    acquisitionDate: '2026-11-19',
    subscriptionPlan: 'Standard Plan',
    status: 'Paid Customer',
    monthlySubscriptionValue: db.assumptions.planPricing.standard,
    assignedSalesExecutiveId: db.users.find((u) => u.role === 'SALES_MANAGER')?.id ?? 'USR-003',
    nextFollowUpDate: '2026-11-26',
    remarks: '',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.customers.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (cityFilter !== 'ALL' && c.city !== cityFilter) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)
      );
    });
  }, [db.customers, search, statusFilter, cityFilter]);

  const paidCount = db.customers.filter((c) => c.status === 'Paid Customer').length;
  const trialCount = db.customers.filter((c) => c.status === 'Trial Customer').length;
  const totalMRRFromCustomers = db.customers
    .filter((c) => c.status === 'Paid Customer')
    .reduce((s, c) => s + c.monthlySubscriptionValue, 0);

  function openNewModal() {
    setEditing(null);
    setErrorMsg(null);
    setForm({
      companyName: '',
      contactPerson: '',
      designation: 'Chief Financial Officer',
      email: '',
      phone: '+91 ',
      industry: 'B2B SaaS',
      companyRevenueRange: '₹50 Cr – ₹150 Cr',
      employeeCount: 120,
      city: 'Bengaluru',
      leadSource: 'LinkedIn Sales Navigator',
      acquisitionDate: '2026-11-19',
      subscriptionPlan: 'Standard Plan',
      status: 'Paid Customer',
      monthlySubscriptionValue: db.assumptions.planPricing.standard,
      assignedSalesExecutiveId: db.users.find((u) => u.role === 'SALES_MANAGER')?.id ?? 'USR-003',
      nextFollowUpDate: '2026-11-26',
      remarks: '',
    });
    setFormOpen(true);
  }

  function openEditModal(c: CustomerRecord) {
    setEditing(c);
    setErrorMsg(null);
    const { id: _id, ...rest } = c;
    setForm(rest);
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const res = editing
      ? await onMutate('PUT', `/api/customers/${editing.id}`, form)
      : await onMutate('POST', '/api/customers', form);
    if (!res.ok) {
      setErrorMsg(res.error || 'Unable to save customer.');
      return;
    }
    setFormOpen(false);
  }

  const getUserName = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Customer Management (CRM)"
        subtitle="Centralized mid-market B2B customer registry across Bengaluru, Mumbai, Delhi-NCR, and US expansion · DEMO DATA"
        actions={
          editable ? (
            <button
              type="button"
              onClick={openNewModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          ) : null
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total CRM Accounts" value={`${db.customers.length}`} subtext="Deduplicated by company & email" />
        <KpiCard label="Paid Customers" value={`${paidCount}`} subtext="Active revenue-generating accounts" highlight="positive" />
        <KpiCard label="Active Trial Customers" value={`${trialCount}`} subtext="14-day guided evaluation cohorts" highlight="accent" />
        <KpiCard label="Contracted Customer MRR" value={formatINR(totalMRRFromCustomers)} subtext="Avg. ticket across paid base" />
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Customer ID, company, contact, email, or industry..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
        >
          <option value="ALL">All Statuses</option>
          {CUSTOMER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
        >
          <option value="ALL">All Geographies</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No matching customers found"
          description="Try clearing your search query or status filter, or register a new customer account."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">ID</th>
                  <th className="py-3 px-4 text-left font-medium">Company & Industry</th>
                  <th className="py-3 px-4 text-left font-medium">Decision Maker</th>
                  <th className="py-3 px-4 text-left font-medium">City</th>
                  <th className="py-3 px-4 text-left font-medium">Plan</th>
                  <th className="py-3 px-4 text-right font-medium">Monthly Value</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  <th className="py-3 px-4 text-left font-medium">Follow-up</th>
                  <th className="py-3 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">{c.id}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{c.companyName}</div>
                      <div className="text-slate-500">{c.industry} · {c.employeeCount} emp</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{c.contactPerson}</div>
                      <div className="text-slate-500">{c.designation} · {c.email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{c.city}</td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{c.subscriptionPlan}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatINR(c.monthlySubscriptionValue)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SemanticStatus status={c.status} />
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {c.nextFollowUpDate}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(c)}
                          className="p-1.5 text-slate-500 hover:text-blue-700 rounded hover:bg-slate-100"
                          title="View Customer Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {editable && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(c)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100"
                              title="Edit Customer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMutate('DELETE', `/api/customers/${c.id}`)}
                              className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50"
                              title="Delete Customer"
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

      {/* Detail Modal */}
      <Modal
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.companyName ?? ''}
        subtitle={
          selectedCustomer
            ? `${selectedCustomer.id} · ${selectedCustomer.industry} · ${selectedCustomer.city}`
            : ''
        }
      >
        {selectedCustomer && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="text-slate-500">Contact Person</div>
                <div className="font-semibold text-slate-900 mt-0.5">{selectedCustomer.contactPerson}</div>
                <div className="text-slate-500">{selectedCustomer.designation}</div>
              </div>
              <div>
                <div className="text-slate-500">Email & Phone</div>
                <div className="font-medium text-slate-900 mt-0.5">{selectedCustomer.email}</div>
                <div className="font-mono text-slate-600">{selectedCustomer.phone}</div>
              </div>
              <div>
                <div className="text-slate-500">Account Owner</div>
                <div className="font-medium text-slate-900 mt-0.5">{getUserName(selectedCustomer.assignedSalesExecutiveId)}</div>
                <div className="text-slate-500">Source: {selectedCustomer.leadSource}</div>
              </div>
              <div>
                <div className="text-slate-500">Company Scale</div>
                <div className="font-medium text-slate-900 mt-0.5">{selectedCustomer.companyRevenueRange}</div>
                <div className="text-slate-500">{selectedCustomer.employeeCount} employees</div>
              </div>
              <div>
                <div className="text-slate-500">Subscription</div>
                <div className="font-medium text-slate-900 mt-0.5">{selectedCustomer.subscriptionPlan}</div>
                <div className="font-mono font-semibold text-blue-700">{formatINR(selectedCustomer.monthlySubscriptionValue)} / mo</div>
              </div>
              <div>
                <div className="text-slate-500">Acquisition & Follow-up</div>
                <div className="font-mono text-slate-900 mt-0.5">Joined: {selectedCustomer.acquisitionDate}</div>
                <div className="font-mono text-slate-600">Next: {selectedCustomer.nextFollowUpDate}</div>
              </div>
            </div>

            <div>
              <div className="text-slate-500 mb-1">Account Remarks</div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-slate-700">
                {selectedCustomer.remarks || 'No remarks logged.'}
              </div>
            </div>

            <div>
              <div className="font-semibold text-slate-900 mb-2">Linked Subscriptions</div>
              <div className="space-y-2">
                {db.subscriptions.filter((s) => s.customerId === selectedCustomer.id).map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 border border-slate-200 rounded-md">
                    <div>
                      <span className="font-mono text-slate-500 mr-2">{s.id}</span>
                      <span className="font-medium text-slate-900">{s.planName}</span>
                      <span className="text-slate-500 ml-2">Renews {s.renewalDate}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-medium">{formatINR(s.subscriptionAmount)}</span>
                      <SemanticStatus status={s.paymentStatus} />
                    </div>
                  </div>
                ))}
                {db.subscriptions.filter((s) => s.customerId === selectedCustomer.id).length === 0 && (
                  <div className="text-slate-500">No active subscription records yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Customer (${editing.id})` : 'Register New Customer'}
        subtitle="Duplicate email addresses and company names are automatically blocked."
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
              {errorMsg}
            </div>
          )}
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
              <label className="block font-medium text-slate-700 mb-1">Designation *</label>
              <input
                required
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Phone Number</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Industry</label>
              <input
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Company Revenue Range</label>
              <select
                value={form.companyRevenueRange}
                onChange={(e) => setForm({ ...form, companyRevenueRange: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option>₹10 Cr – ₹25 Cr</option>
                <option>₹25 Cr – ₹50 Cr</option>
                <option>₹50 Cr – ₹150 Cr</option>
                <option>₹150 Cr – ₹300 Cr</option>
                <option>₹300 Cr+</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Employee Count</label>
              <input
                type="number"
                min={1}
                value={form.employeeCount}
                onChange={(e) => setForm({ ...form, employeeCount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">City</label>
              <select
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Lead Source</label>
              <select
                value={form.leadSource}
                onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Customer Status</label>
              <select
                value={form.status}
                onChange={(e) => {
                  const status = e.target.value as CustomerStatus;
                  setForm({
                    ...form,
                    status,
                    monthlySubscriptionValue:
                      status === 'Paid Customer'
                        ? getPlanPrice(form.subscriptionPlan, db.assumptions.planPricing)
                        : status === 'Inactive Customer'
                        ? 0
                        : form.monthlySubscriptionValue,
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Subscription Plan</label>
              <select
                value={form.subscriptionPlan}
                onChange={(e) => {
                  const plan = e.target.value as PlanTier;
                  setForm({
                    ...form,
                    subscriptionPlan: plan,
                    monthlySubscriptionValue: getPlanPrice(plan, db.assumptions.planPricing),
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Monthly Value (₹)</label>
              <input
                type="number"
                min={0}
                value={form.monthlySubscriptionValue}
                onChange={(e) => setForm({ ...form, monthlySubscriptionValue: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Assigned Executive</label>
              <select
                value={form.assignedSalesExecutiveId}
                onChange={(e) => setForm({ ...form, assignedSalesExecutiveId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {db.users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Acquisition Date</label>
              <input
                type="date"
                value={form.acquisitionDate}
                onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Next Follow-Up Date</label>
              <input
                type="date"
                value={form.nextFollowUpDate}
                onChange={(e) => setForm({ ...form, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Remarks</label>
            <textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844]"
            >
              {editing ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
