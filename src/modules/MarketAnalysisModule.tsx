import React, { useState } from 'react';
import type { ApexDatabase } from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { formatCompactINR, formatINR, formatNumberIN, formatPct } from '../shared/financialUtils.ts';
import { KpiCard, SectionHeader } from '../components/UiPrimitives.tsx';

export function MarketAnalysisModule({
  db,
  metrics,
}: {
  db: ApexDatabase;
  metrics: ComputedMetrics;
}) {
  const { market } = db.assumptions;
  const [targetSomCustomers, setTargetSomCustomers] = useState(market.obtainableCustomers);

  const somCapturePct = market.obtainableCustomers > 0 ? (metrics.live.paidCustomers / market.obtainableCustomers) * 100 : 0;
  const somRevenuePct = market.som > 0 ? (metrics.live.arr / market.som) * 100 : 0;
  const simulatedArr = targetSomCustomers * market.annualSpendPerCustomer;

  const tiers = [
    {
      code: 'TAM',
      label: 'Total Addressable Market',
      value: market.tam,
      customers: market.potentialCustomers,
      desc: 'Mid-market B2B enterprises & SaaS firms across India and initial US corridors',
      barColor: 'bg-[#0B192C]',
      widthPct: 100,
    },
    {
      code: 'SAM',
      label: 'Serviceable Available Market',
      value: market.sam,
      customers: market.serviceableCustomers,
      desc: 'Mid-market B2B SaaS firms in Bengaluru, Mumbai, Delhi-NCR & Tier-1 tech hubs',
      barColor: 'bg-blue-700',
      widthPct: 56,
    },
    {
      code: 'SOM',
      label: 'Serviceable Obtainable Market',
      value: market.som,
      customers: market.obtainableCustomers,
      desc: 'Year 1–3 obtainable customer target at ₹3,00,000 annual ACV',
      barColor: 'bg-emerald-600',
      widthPct: 26,
    },
  ];

  const geographies = [
    { region: 'Bengaluru', focus: 'SaaS & DeepTech HQ Hub', targetCustomers: 100, current: db.customers.filter((c) => c.city === 'Bengaluru' && c.status === 'Paid Customer').length },
    { region: 'Mumbai', focus: 'FinTech & Enterprise Finance', targetCustomers: 70, current: db.customers.filter((c) => c.city === 'Mumbai' && c.status === 'Paid Customer').length },
    { region: 'Delhi-NCR', focus: 'Commerce, Logistics & Enterprise SaaS', targetCustomers: 55, current: db.customers.filter((c) => c.city === 'Delhi-NCR' && c.status === 'Paid Customer').length },
    { region: 'United States (Expansion)', focus: 'Cross-border India-US SaaS Corridors', targetCustomers: 25, current: db.customers.filter((c) => c.city === 'US-Expansion' && c.status === 'Paid Customer').length },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Market Size & Opportunity Analysis"
        subtitle="Venture TAM / SAM / SOM sizing, ACV assumptions, and geographic expansion roadmap · DEMO DATA"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Addressable Market (TAM)" value={formatINR(market.tam)} subtext={`${formatNumberIN(market.potentialCustomers)} potential customers`} />
        <KpiCard label="Serviceable Available Market (SAM)" value={formatINR(market.sam)} subtext={`${formatNumberIN(market.serviceableCustomers)} serviceable customers`} highlight="accent" />
        <KpiCard label="Serviceable Obtainable Market (SOM)" value={formatINR(market.som)} subtext={`${formatNumberIN(market.obtainableCustomers)} obtainable customers`} highlight="positive" />
        <KpiCard label="Annual Spending / Customer (ACV)" value={formatINR(market.annualSpendPerCustomer)} subtext={`Live ARR capture: ${formatPct(somRevenuePct)} of SOM`} />
      </div>

      {/* TAM -> SAM -> SOM Visual Funnel + Penetration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Market Opportunity Funnel (INR Scale)</h2>
            <p className="text-xs text-slate-500">Top-down & bottom-up validation at {formatINR(market.annualSpendPerCustomer)} annual ACV</p>
          </div>
          <div className="space-y-4">
            {tiers.map((t) => (
              <div key={t.code} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-semibold text-slate-900 mr-2">{t.code}</span>
                    <span className="font-medium text-slate-800">{t.label}</span>
                  </div>
                  <div className="font-mono tabular-nums text-right">
                    <span className="font-semibold text-slate-900">{formatINR(t.value)}</span>
                    <span className="text-slate-500 ml-2">({formatCompactINR(t.value)})</span>
                  </div>
                </div>
                <div className="h-7 bg-slate-100 rounded-md overflow-hidden flex items-center">
                  <div
                    className={`h-full ${t.barColor} text-white text-[11px] font-mono tabular-nums px-3 flex items-center justify-between transition-all`}
                    style={{ width: `${t.widthPct}%` }}
                  >
                    <span>{formatNumberIN(t.customers)} firms</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">SOM Penetration & Scale Simulator</h2>
            <p className="text-xs text-slate-500">Model ARR trajectory as Apex Tech scales toward the 250-customer SOM</p>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-md space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Current Paid Customer Footprint</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900">
                {metrics.live.paidCustomers} / {market.obtainableCustomers} ({formatPct(somCapturePct)})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Current Live ARR vs SOM Target</span>
              <span className="font-mono tabular-nums font-semibold text-blue-700">
                {formatINR(metrics.live.arr)} / {formatINR(market.som)}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs pt-2">
            <div className="flex justify-between">
              <label htmlFor="som-slider" className="font-medium text-slate-700">
                Simulated Obtainable Customers
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900">{targetSomCustomers} accounts</span>
            </div>
            <input
              id="som-slider"
              type="range"
              min={20}
              max={500}
              step={5}
              value={targetSomCustomers}
              onChange={(e) => setTargetSomCustomers(Number(e.target.value))}
              className="w-full accent-[#0B192C]"
            />
            <div className="flex justify-between pt-1 border-t border-slate-100">
              <span className="text-slate-600">Projected Annualized Revenue (ARR)</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-700">{formatINR(simulatedArr)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Share of SAM ({formatCompactINR(market.sam)})</span>
              <span className="font-mono tabular-nums text-slate-800">{formatPct((simulatedArr / Math.max(market.sam, 1)) * 100)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Target Geography Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Target Geography Penetration Roadmap</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 text-left font-medium">Target Geography</th>
                <th className="py-3 px-4 text-left font-medium">Industry Focus</th>
                <th className="py-3 px-4 text-right font-medium">Active Paid Customers</th>
                <th className="py-3 px-4 text-right font-medium">SOM Allocation Target</th>
                <th className="py-3 px-4 text-right font-medium">Target Annual ARR</th>
                <th className="py-3 px-4 text-left font-medium w-48">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {geographies.map((g) => {
                const pct = Math.min(100, (g.current / g.targetCustomers) * 100);
                return (
                  <tr key={g.region} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{g.region}</td>
                    <td className="py-3 px-4 text-slate-600">{g.focus}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900">{g.current}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{g.targetCustomers}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatINR(g.targetCustomers * market.annualSpendPerCustomer)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-sm overflow-hidden">
                          <div className="h-full bg-[#0B192C]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-slate-600 w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
