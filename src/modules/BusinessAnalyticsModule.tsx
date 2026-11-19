import React from 'react';
import type { ApexDatabase } from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { formatINR, formatPct } from '../shared/financialUtils.ts';
import { KpiCard, SectionHeader } from '../components/UiPrimitives.tsx';
import { BreakEvenChart, CustomerSubscriptionChart, RevenueExpenseChart } from '../components/Charts.tsx';

export function BusinessAnalyticsModule({
  db,
  metrics,
}: {
  db: ApexDatabase;
  metrics: ComputedMetrics;
}) {
  const { live, benchmark } = metrics;

  const cityMap = db.customers.reduce<Record<string, { total: number; paid: number; mrr: number }>>((acc, c) => {
    if (!acc[c.city]) acc[c.city] = { total: 0, paid: 0, mrr: 0 };
    acc[c.city].total += 1;
    if (c.status === 'Paid Customer') {
      acc[c.city].paid += 1;
      acc[c.city].mrr += c.monthlySubscriptionValue;
    }
    return acc;
  }, {});
  const cities = Object.entries(cityMap).sort((a, b) => b[1].mrr - a[1].mrr);

  const ltvEstimate =
    live.paidCustomers > 0
      ? (live.mrr / live.paidCustomers) * 24 // 24-month conservative SaaS cohort horizon
      : benchmark.sellingPrice * 24;
  const ltvCacRatio = live.cac > 0 ? ltvEstimate / live.cac : 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Business Performance Analytics"
        subtitle="Growth velocity, unit economics efficiency, retention cohorts, and regional footprint · DEMO DATA"
      />

      {/* 10 Required Performance Analytics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Revenue Growth (MoM)"
          value={formatPct(live.revenueGrowthRatePct)}
          subtext={`Nov ${formatINR(live.currentMonthRevenue)} vs Oct ${formatINR(live.previousMonthRevenue)}`}
          highlight={live.revenueGrowthRatePct >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          label="Customer Growth (MoM)"
          value={formatPct(live.customerGrowthRatePct)}
          subtext={`${live.paidCustomers} active paid accounts`}
          highlight="accent"
        />
        <KpiCard
          label="Subscription Growth (MoM)"
          value={formatPct(live.subscriptionGrowthRatePct)}
          subtext={`${live.activeSubscriptions} active subscriptions`}
        />
        <KpiCard
          label="Monthly Profitability"
          value={formatINR(live.monthlyProfitability)}
          subtext="Current month net operating surplus"
          highlight={live.monthlyProfitability >= 0 ? 'positive' : 'negative'}
        />
        <KpiCard
          label="Expense Growth (MoM)"
          value={formatPct(live.expenseGrowthRatePct)}
          subtext="Operating cost scaling rate"
        />
        <KpiCard
          label="Contribution Margin"
          value={formatPct(live.contributionMarginPctActual)}
          subtext={`${formatINR(live.contributionPerCustomerActual)} per customer`}
          highlight="positive"
        />
        <KpiCard
          label="Break-Even Analysis"
          value={`${live.breakEvenCustomersActual} Customers`}
          subtext={`Currently at ${(live.paidCustomers / Math.max(live.breakEvenCustomersActual, 1)).toFixed(1)}× BEP`}
        />
        <KpiCard
          label="Customer Acquisition Cost"
          value={formatINR(live.cac)}
          subtext={`LTV:CAC ≈ ${ltvCacRatio.toFixed(1)}× (24m horizon)`}
        />
        <KpiCard
          label="Sales Conversion Rate"
          value={formatPct(live.leadToCustomerConversionPct)}
          subtext={`Demo conversion: ${formatPct(live.demoConversionRatePct)}`}
        />
        <KpiCard
          label="Customer Retention Rate"
          value={formatPct(live.customerRetentionRatePct)}
          subtext="Active vs churned cohort base"
          highlight="positive"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Revenue, Expense & Surplus Trajectory</h2>
          <p className="text-xs text-slate-500 mb-4">Monthly operating leverage as customer base scales past break-even</p>
          <RevenueExpenseChart data={live.monthlySeries} />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Customer & Subscription Expansion</h2>
          <p className="text-xs text-slate-500 mb-4">Cumulative customer onboarding vs. active billing subscriptions</p>
          <CustomerSubscriptionChart data={live.monthlySeries} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Break-Even Margin-of-Safety Curve</h2>
          <p className="text-xs text-slate-500 mb-4">
            Break-even at ~{benchmark.breakEvenCustomersCeil} customers vs. {live.paidCustomers} active paying customers
          </p>
          <BreakEvenChart
            sellingPrice={benchmark.sellingPrice}
            variableCost={benchmark.variableCostPerCustomer}
            fixedCost={benchmark.monthlyFixedCost}
            expectedCustomers={benchmark.expectedCustomers}
            actualCustomers={live.paidCustomers}
          />
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Regional Distribution & Expansion</h2>
          <p className="text-xs text-slate-500 mb-4">Core Indian metro hubs & US market pilot footprint</p>
          <div className="space-y-3">
            {cities.map(([city, stats]) => {
              const share = live.mrr > 0 ? (stats.mrr / live.mrr) * 100 : 0;
              return (
                <div key={city} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900">{city}</span>
                    <span className="font-mono tabular-nums text-slate-700">
                      {stats.paid} paid ({stats.total} total) · {formatINR(stats.mrr)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                    <div className="h-full bg-blue-700" style={{ width: `${Math.min(100, share)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
