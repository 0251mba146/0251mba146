import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  ApexDatabase,
  ExpenseCategory,
  ExpenseCostType,
  ExpenseTransaction,
  RevenueCategory,
  RevenueTransaction,
  UserRole,
} from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { canEditModule, formatINR, formatPct, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { KpiCard, Modal, ReadOnlyBanner, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';
import { BreakEvenChart } from '../components/Charts.tsx';

const REVENUE_CATEGORIES: RevenueCategory[] = [
  'Subscription Revenue',
  'Onboarding & Setup',
  'API Integration Fee',
  'Advisory & Other',
];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Fixed Expenses',
  'Variable Expenses',
  'Employee Salaries',
  'Cloud Hosting',
  'API Integration Costs',
  'Marketing Expenses',
  'Administrative Expenses',
  'Other Operational Expenses',
];

export function FinancialManagementModule({
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
  const editable = canEditModule(role, 'financials');
  const [tab, setTab] = useState<'profitability' | 'revenue' | 'expenses'>('profitability');
  const [revModal, setRevModal] = useState(false);
  const [expModal, setExpModal] = useState(false);

  const [revForm, setRevForm] = useState<Omit<RevenueTransaction, 'id'>>({
    customerId: db.customers[0]?.id ?? 'CUST-001',
    subscriptionId: db.subscriptions[0]?.id ?? 'SUB-001',
    category: 'Subscription Revenue',
    amount: 25000,
    date: '2026-11-19',
    quarter: 'Q3',
    fiscalYear: 'FY26-27',
    paymentMethod: 'NEFT / Corporate Bank',
    status: 'Received',
    description: '',
  });

  const [expForm, setExpForm] = useState<Omit<ExpenseTransaction, 'id'>>({
    category: 'Cloud Hosting',
    costType: 'Variable',
    vendor: '',
    amount: 15000,
    date: '2026-11-19',
    department: 'Platform',
    approvalStatus: 'Approved',
    notes: '',
  });

  const { benchmark, live } = metrics;

  // Aggregate Revenue by Category & Quarter
  const subscriptionRevTotal = db.revenueTransactions
    .filter((r) => r.category === 'Subscription Revenue')
    .reduce((s, r) => s + r.amount, 0);
  const otherRevTotal = live.totalRevenue - subscriptionRevTotal;

  const quarterBreakdown = ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
    const qRev = db.revenueTransactions
      .filter((r) => r.quarter === q)
      .reduce((s, r) => s + r.amount, 0);
    return { quarter: q, revenue: qRev };
  });

  const expenseCategorySummary = EXPENSE_CATEGORIES.map((cat) => {
    const amt = db.expenseTransactions
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amount, 0);
    return { category: cat, amount: amt };
  });

  const getCustomerName = (id: string) => db.customers.find((c) => c.id === id)?.companyName ?? id;

  async function saveRevenue(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/revenue', revForm);
    if (res.ok) setRevModal(false);
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/expenses', expForm);
    if (res.ok) setExpModal(false);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Financial Management & Profitability Engine"
        subtitle="Revenue ledger, categorized operating expenses, and automated contribution / break-even calculations · DEMO DATA"
        actions={
          editable ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRevModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Revenue
              </button>
              <button
                type="button"
                onClick={() => setExpModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Expense
              </button>
            </div>
          ) : null
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      {/* Top Profitability Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue (All Transactions)" value={formatINR(live.totalRevenue)} subtext={`Subscription ${formatINR(subscriptionRevTotal)} · Other ${formatINR(otherRevTotal)}`} />
        <KpiCard label="Total Expenses (Fixed + Var + Ops)" value={formatINR(live.totalExpenses)} subtext={`Nov Fixed ${formatINR(live.monthlyFixedExpenses)} · Var ${formatINR(live.monthlyVariableExpenses)}`} />
        <KpiCard
          label="Operating Surplus"
          value={formatINR(live.operatingSurplusTotal)}
          subtext="Total Revenue − Total Expenses"
          highlight={live.operatingSurplusTotal >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          label="Contribution Margin"
          value={formatPct(live.contributionMarginPctActual)}
          subtext={`${formatINR(live.contributionPerCustomerActual)} / cust · BEP ${live.breakEvenCustomersActual} customers`}
          highlight="accent"
        />
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { key: 'profitability', label: 'Profitability & Formulas' },
          { key: 'revenue', label: `Revenue Ledger (${db.revenueTransactions.length})` },
          { key: 'expenses', label: `Expense Ledger (${db.expenseTransactions.length})` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key as 'profitability' | 'revenue' | 'expenses')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              tab === item.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profitability' && (
        <div className="space-y-6">
          {/* Automated Financial Formula Verification Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Automated Financial Validation Engine</h2>
                <p className="text-xs text-slate-500">Venture Plan base unit economics vs. live operational actuals</p>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Selling Price (Monthly Base)</span>
                  <span className="font-mono tabular-nums font-medium">{formatINR(benchmark.sellingPrice)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Variable Cost / Customer</span>
                  <span className="font-mono tabular-nums font-medium">{formatINR(benchmark.variableCostPerCustomer)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Contribution Per Customer (P − VC)</span>
                  <span className="font-mono tabular-nums font-semibold text-blue-700">{formatINR(benchmark.contributionPerCustomer)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Contribution Margin ((P − VC) / P × 100)</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">{formatPct(benchmark.contributionMarginPct)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Monthly Fixed Cost</span>
                  <span className="font-mono tabular-nums font-medium">{formatINR(benchmark.monthlyFixedCost)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Expected Base Customers</span>
                  <span className="font-mono tabular-nums font-medium">{benchmark.expectedCustomers}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Expected Monthly Revenue</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">{formatINR(benchmark.expectedMonthlyRevenue)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Total Variable Cost ({benchmark.expectedCustomers} × {formatINR(benchmark.variableCostPerCustomer)})</span>
                  <span className="font-mono tabular-nums">{formatINR(benchmark.totalVariableCost)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Total Monthly Operating Cost</span>
                  <span className="font-mono tabular-nums font-medium">{formatINR(benchmark.totalMonthlyOperatingCost)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Expected Operating Surplus</span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">{formatINR(benchmark.expectedOperatingSurplus)}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-600">Break-Even Customers (Fixed / Contrib)</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {benchmark.breakEvenCustomersExact.toFixed(2)} (~{benchmark.breakEvenCustomersCeil} customers)
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Break-Even & Unit Economics Curve</h2>
                <p className="text-xs text-slate-500">Revenue slope vs. fixed + variable cost intersection</p>
              </div>
              <BreakEvenChart
                sellingPrice={benchmark.sellingPrice}
                variableCost={benchmark.variableCostPerCustomer}
                fixedCost={benchmark.monthlyFixedCost}
                expectedCustomers={benchmark.expectedCustomers}
                actualCustomers={live.paidCustomers}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
                <div>
                  <div className="text-slate-500">Quarterly Revenue (FY26-27)</div>
                  <div className="mt-1 space-y-1 font-mono tabular-nums">
                    {quarterBreakdown.map((q) => (
                      <div key={q.quarter} className="flex justify-between">
                        <span className="text-slate-600">{q.quarter}</span>
                        <span className="font-medium text-slate-900">{formatINR(q.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-slate-500">Cumulative Expense Breakdown (All Categories)</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono tabular-nums">
                    {expenseCategorySummary.map((item) => (
                      <div key={item.category} className="flex justify-between text-[11px]">
                        <span className="font-sans text-slate-600 truncate pr-2">{item.category}</span>
                        <span className="font-medium text-slate-900">{formatINR(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'revenue' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Txn ID</th>
                  <th className="py-3 px-4 text-left font-medium">Date / Quarter</th>
                  <th className="py-3 px-4 text-left font-medium">Customer</th>
                  <th className="py-3 px-4 text-left font-medium">Category</th>
                  <th className="py-3 px-4 text-left font-medium">Payment Method</th>
                  <th className="py-3 px-4 text-right font-medium">Amount</th>
                  <th className="py-3 px-4 text-left font-medium">Status</th>
                  {editable && <th className="py-3 px-4 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.revenueTransactions.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">{r.id}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {r.date} · {r.quarter}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{getCustomerName(r.customerId)}</div>
                      <div className="text-slate-500">{r.description}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{r.category}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{r.paymentMethod}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatINR(r.amount)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SemanticStatus status={r.status} />
                    </td>
                    {editable && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {r.status !== 'Received' && (
                            <button
                              type="button"
                              onClick={() => onMutate('PUT', `/api/revenue/${r.id}`, { status: 'Received' })}
                              className="px-2 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50"
                            >
                              Mark Received
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onMutate('DELETE', `/api/revenue/${r.id}`)}
                            className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50"
                            title="Delete Transaction"
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
      )}

      {tab === 'expenses' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 text-left font-medium">Exp ID</th>
                  <th className="py-3 px-4 text-left font-medium">Date</th>
                  <th className="py-3 px-4 text-left font-medium">Category</th>
                  <th className="py-3 px-4 text-left font-medium">Cost Type</th>
                  <th className="py-3 px-4 text-left font-medium">Vendor & Notes</th>
                  <th className="py-3 px-4 text-left font-medium">Department</th>
                  <th className="py-3 px-4 text-right font-medium">Amount</th>
                  <th className="py-3 px-4 text-left font-medium">Approval</th>
                  {editable && <th className="py-3 px-4 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.expenseTransactions.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">{e.id}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">{e.date}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">{e.category}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{e.costType}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{e.vendor}</div>
                      <div className="text-slate-500">{e.notes}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{e.department}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatINR(e.amount)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SemanticStatus status={e.approvalStatus} />
                    </td>
                    {editable && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {e.approvalStatus === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => onMutate('PUT', `/api/expenses/${e.id}`, { approvalStatus: 'Approved' })}
                              className="px-2 py-1 text-[11px] font-medium text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-50"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onMutate('DELETE', `/api/expenses/${e.id}`)}
                            className="p-1.5 text-slate-400 hover:text-red-700 rounded hover:bg-red-50"
                            title="Delete Expense"
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
      )}

      {/* Revenue Modal */}
      <Modal open={revModal} onClose={() => setRevModal(false)} title="Record Revenue Transaction">
        <form onSubmit={saveRevenue} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Customer</label>
              <select
                value={revForm.customerId}
                onChange={(e) => setRevForm({ ...revForm, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {db.customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={revForm.category}
                onChange={(e) => setRevForm({ ...revForm, category: e.target.value as RevenueCategory })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {REVENUE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={0}
                required
                value={revForm.amount}
                onChange={(e) => setRevForm({ ...revForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={revForm.date}
                onChange={(e) => setRevForm({ ...revForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Quarter</label>
              <select
                value={revForm.quarter}
                onChange={(e) => setRevForm({ ...revForm, quarter: e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option>Q1</option>
                <option>Q2</option>
                <option>Q3</option>
                <option>Q4</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Status</label>
              <select
                value={revForm.status}
                onChange={(e) => setRevForm({ ...revForm, status: e.target.value as 'Received' | 'Pending' | 'Overdue' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option>Received</option>
                <option>Pending</option>
                <option>Overdue</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Description</label>
            <input
              value={revForm.description}
              onChange={(e) => setRevForm({ ...revForm, description: e.target.value })}
              placeholder="e.g., Monthly SaaS retainer invoice"
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRevModal(false)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md">
              Save Transaction
            </button>
          </div>
        </form>
      </Modal>

      {/* Expense Modal */}
      <Modal open={expModal} onClose={() => setExpModal(false)} title="Record Expense Transaction">
        <form onSubmit={saveExpense} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={expForm.category}
                onChange={(e) => setExpForm({ ...expForm, category: e.target.value as ExpenseCategory })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Cost Type</label>
              <select
                value={expForm.costType}
                onChange={(e) => setExpForm({ ...expForm, costType: e.target.value as ExpenseCostType })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
              >
                <option value="Fixed">Fixed</option>
                <option value="Variable">Variable</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Vendor / Payee *</label>
              <input
                required
                value={expForm.vendor}
                onChange={(e) => setExpForm({ ...expForm, vendor: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                min={0}
                required
                value={expForm.amount}
                onChange={(e) => setExpForm({ ...expForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={expForm.date}
                onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Department</label>
              <input
                value={expForm.department}
                onChange={(e) => setExpForm({ ...expForm, department: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Notes</label>
            <input
              value={expForm.notes}
              onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setExpModal(false)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md">
              Save Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
