import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { ApexDatabase, ModuleKey } from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { formatINR, formatPct } from '../shared/financialUtils.ts';
import { KpiCard, SectionHeader, SemanticStatus } from '../components/UiPrimitives.tsx';
import { CustomerSubscriptionChart, RevenueExpenseChart } from '../components/Charts.tsx';

export function ExecutiveDashboard({
  db,
  metrics,
  onNavigate,
}: {
  db: ApexDatabase;
  metrics: ComputedMetrics;
  onNavigate: (mod: ModuleKey) => void;
}) {
  const { live, benchmark } = metrics;

  // Expense category breakdown for current reference month (Nov 2026)
  const currentMonthKey = live.monthlySeries[live.monthlySeries.length - 1]?.monthKey ?? '2026-11';
  const currentExpenses = db.expenseTransactions.filter((e) => e.date.startsWith(currentMonthKey));
  const categoryTotals = currentExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const totalCurrentExp = Math.max(live.currentMonthExpenses, 1);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Executive Financial Dashboard"
        subtitle="Real-time financial performance, recurring revenue, and unit economics derived from live platform tables · DEMO DATA"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('financials')}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Financial Ledger
            </button>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-3.5 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] transition-colors whitespace-nowrap shrink-0"
            >
              Executive Reports
            </button>
          </div>
        }
      />

      {/* All 12 Core Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Revenue (6M Cumulative)"
          value={formatINR(live.totalRevenue)}
          subtext={`Nov MTD: ${formatINR(live.currentMonthRevenue)}`}
          trend={{
            value: `${live.revenueGrowthRatePct >= 0 ? '+' : ''}${live.revenueGrowthRatePct.toFixed(1)}% MoM`,
            positive: live.revenueGrowthRatePct >= 0,
          }}
        />
        <KpiCard
          label="Monthly Recurring Revenue (MRR)"
          value={formatINR(live.mrr)}
          subtext={`Plan Target: ${formatINR(benchmark.expectedMonthlyRevenue)}`}
          highlight="accent"
        />
        <KpiCard
          label="Annual Recurring Revenue (ARR)"
          value={formatINR(live.arr)}
          subtext="Annualized active subscription run-rate"
        />
        <KpiCard
          label="Monthly Profitability (Net)"
          value={formatINR(live.monthlyProfitability)}
          subtext={`Nov Revenue ${formatINR(live.currentMonthRevenue)} − Expenses ${formatINR(live.currentMonthExpenses)}`}
          highlight={live.monthlyProfitability >= 0 ? 'positive' : 'negative'}
        />

        <KpiCard
          label="Total Customers (CRM)"
          value={`${live.totalCustomers}`}
          subtext={`${live.paidCustomers} Paid · ${live.trialCustomers} Trial · ${live.totalCustomers - live.paidCustomers - live.trialCustomers} Pipeline/Inactive`}
          trend={{
            value: `${live.customerGrowthRatePct >= 0 ? '+' : ''}${live.customerGrowthRatePct.toFixed(1)}% MoM`,
            positive: live.customerGrowthRatePct >= 0,
          }}
        />
        <KpiCard
          label="Active Subscriptions"
          value={`${live.activeSubscriptions}`}
          subtext={`${live.expiringSubscriptions} expiring soon · ${live.overdueSubscriptions} overdue`}
        />
        <KpiCard
          label="Monthly Operating Expenses"
          value={formatINR(live.currentMonthExpenses)}
          subtext={`Fixed ${formatINR(live.monthlyFixedExpenses)} · Variable ${formatINR(live.monthlyVariableExpenses)}`}
        />
        <KpiCard
          label="Total Variable Costs (Monthly)"
          value={formatINR(live.monthlyVariableExpenses)}
          subtext={`Benchmark: ${formatINR(benchmark.totalVariableCost)} (${benchmark.expectedCustomers} × ${formatINR(benchmark.variableCostPerCustomer)})`}
        />

        <KpiCard
          label="Contribution Margin"
          value={formatPct(live.contributionMarginPctActual)}
          subtext={`${formatINR(live.contributionPerCustomerActual)} contribution / customer`}
          highlight="positive"
        />
        <KpiCard
          label="Operating Surplus (Cumulative)"
          value={formatINR(live.operatingSurplusTotal)}
          subtext={`Plan Benchmark Monthly: ${formatINR(benchmark.expectedOperatingSurplus)}`}
          highlight={live.operatingSurplusTotal >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          label="Customer Acquisition Cost (CAC)"
          value={formatINR(live.cac)}
          subtext={`Payback < ${(live.cac / Math.max(live.contributionPerCustomerActual, 1)).toFixed(1)} months`}
        />
        <KpiCard
          label="Customer Growth Rate (MoM)"
          value={formatPct(live.customerGrowthRatePct)}
          subtext={`Break-even threshold: ${live.breakEvenCustomersActual} customers`}
          trend={{
            value: `${live.paidCustomers} / ${live.breakEvenCustomersActual} BEP`,
            positive: live.paidCustomers >= live.breakEvenCustomersActual,
          }}
        />
      </div>

      {/* Charts Row 1: Revenue vs Expenses + Customer & Subscription Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Revenue vs. Operating Expenses & Surplus</h2>
              <p className="text-xs text-slate-500">6-month financial performance trajectory (Jun 2026 – Nov 2026)</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Deep Analytics <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <RevenueExpenseChart data={live.monthlySeries} />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Customer & Subscription Growth</h2>
              <p className="text-xs text-slate-500">Cumulative paying accounts vs active billing plans</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('subscriptions')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              Subscriptions <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <CustomerSubscriptionChart data={live.monthlySeries} />
        </div>
      </div>

      {/* Expense Breakdown + Venture Plan Validation Benchmark */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Current Month Expense Analysis</h2>
              <p className="text-xs text-slate-500">Category breakdown for {currentMonthKey} across fixed, variable, and growth ops</p>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-900">
              {formatINR(live.currentMonthExpenses)}
            </span>
          </div>
          <div className="space-y-3">
            {sortedCategories.map(([category, amt]) => {
              const pct = (amt / totalCurrentExp) * 100;
              return (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{category}</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {formatINR(amt)} <span className="text-slate-400">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                    <div className="h-full bg-[#0B192C]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Venture Plan Unit Economics Benchmark</h2>
              <p className="text-xs text-slate-500">Automated comparison between DGU Venture Plan targets and live database</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              Configure Model
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 text-left font-medium">Metric</th>
                  <th className="py-2 text-right font-medium">Plan Benchmark</th>
                  <th className="py-2 text-right font-medium">Live Actual</th>
                  <th className="py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 text-slate-700">Paid Customer Base</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{benchmark.expectedCustomers}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-medium">{live.paidCustomers}</td>
                  <td className="py-2.5 text-right">
                    <SemanticStatus status={live.paidCustomers >= benchmark.expectedCustomers ? 'On Target' : 'Building'} tone={live.paidCustomers >= benchmark.expectedCustomers ? 'positive' : 'warning'} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-700">Monthly Recurring Revenue</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{formatINR(benchmark.expectedMonthlyRevenue)}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-medium">{formatINR(live.mrr)}</td>
                  <td className="py-2.5 text-right">
                    <SemanticStatus status={live.mrr >= benchmark.expectedMonthlyRevenue ? 'Validated' : 'In Progress'} tone={live.mrr >= benchmark.expectedMonthlyRevenue ? 'positive' : 'warning'} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-700">Monthly Fixed Cost</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{formatINR(benchmark.monthlyFixedCost)}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-medium">{formatINR(live.monthlyFixedExpenses)}</td>
                  <td className="py-2.5 text-right">
                    <SemanticStatus status={live.monthlyFixedExpenses <= benchmark.monthlyFixedCost ? 'Within Plan' : 'Over Budget'} tone={live.monthlyFixedExpenses <= benchmark.monthlyFixedCost ? 'positive' : 'negative'} />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-700">Contribution Margin</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{formatPct(benchmark.contributionMarginPct)}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-medium">{formatPct(live.contributionMarginPctActual)}</td>
                  <td className="py-2.5 text-right">
                    <SemanticStatus status="Nominal" tone="positive" />
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 text-slate-700">Break-Even Threshold</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">{benchmark.breakEvenCustomersCeil} customers</td>
                  <td className="py-2.5 text-right font-mono tabular-nums font-medium">{live.breakEvenCustomersActual} customers</td>
                  <td className="py-2.5 text-right">
                    <SemanticStatus status={live.paidCustomers >= live.breakEvenCustomersActual ? 'Profitable' : 'Pre-BEP'} tone={live.paidCustomers >= live.breakEvenCustomersActual ? 'positive' : 'warning'} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Monthly Performance Snapshot Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Monthly Financial Performance Summary</h2>
          <span className="text-xs text-slate-500">Avg. Customer Time Saved: {live.avgReportingHoursSaved.toFixed(1)} hrs/week</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 text-left font-medium">Month</th>
                <th className="py-2.5 text-right font-medium">Subscription Rev</th>
                <th className="py-2.5 text-right font-medium">Other Rev</th>
                <th className="py-2.5 text-right font-medium">Total Revenue</th>
                <th className="py-2.5 text-right font-medium">Fixed Exp</th>
                <th className="py-2.5 text-right font-medium">Variable Exp</th>
                <th className="py-2.5 text-right font-medium">Total Expenses</th>
                <th className="py-2.5 text-right font-medium">Operating Surplus</th>
                <th className="py-2.5 text-right font-medium">Active Customers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {live.monthlySeries.map((row) => (
                <tr key={row.monthKey} className="hover:bg-slate-50">
                  <td className="py-2.5 font-sans font-medium text-slate-900">{row.label}</td>
                  <td className="py-2.5 text-right text-slate-700">{formatINR(row.subscriptionRevenue)}</td>
                  <td className="py-2.5 text-right text-slate-500">{formatINR(row.otherRevenue)}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">{formatINR(row.revenue)}</td>
                  <td className="py-2.5 text-right text-slate-700">{formatINR(row.fixedExpenses)}</td>
                  <td className="py-2.5 text-right text-slate-700">{formatINR(row.variableExpenses)}</td>
                  <td className="py-2.5 text-right text-slate-700">{formatINR(row.totalExpenses)}</td>
                  <td className={`py-2.5 text-right font-semibold ${row.operatingSurplus >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatINR(row.operatingSurplus)}
                  </td>
                  <td className="py-2.5 text-right text-slate-900">{row.activeCustomers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
