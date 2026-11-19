import React, { useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import type { ApexDatabase, FinancialReportRecord, ReportPeriodType, UserRole } from '../shared/types.ts';
import type { ComputedMetrics } from '../shared/financialUtils.ts';
import { canEditModule, formatINR, formatPct, ROLE_PERMISSIONS } from '../shared/financialUtils.ts';
import { Modal, ReadOnlyBanner, SectionHeader } from '../components/UiPrimitives.tsx';

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? '').replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsModule({
  db,
  metrics,
  role,
  currentUserId,
  onMutate,
}: {
  db: ApexDatabase;
  metrics: ComputedMetrics;
  role: UserRole;
  currentUserId: string;
  onMutate: (method: string, url: string, body?: unknown) => Promise<{ ok: boolean; error?: string }>;
}) {
  const editable = canEditModule(role, 'reports');
  const [periodType, setPeriodType] = useState<ReportPeriodType>('Monthly');
  const [periodLabel, setPeriodLabel] = useState('Nov 2026 (Full Snapshot)');
  const [summaryNotes, setSummaryNotes] = useState('');
  const [previewReport, setPreviewReport] = useState<FinancialReportRecord | null>(
    db.financialReports[0] ?? null
  );
  const [genOpen, setGenOpen] = useState(false);

  const getUserName = (id: string) => db.users.find((u) => u.id === id)?.name ?? id;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    const res = await onMutate('POST', '/api/reports/generate', {
      periodType,
      periodLabel,
      generatedById: currentUserId,
      summaryNotes,
    });
    if (res.ok) {
      setGenOpen(false);
      setSummaryNotes('');
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Executive Reports & Financial Statements"
        subtitle="Generate Monthly, Quarterly, and Annual board packs from live platform data or export CSV datasets · DEMO DATA"
        actions={
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Executive Pack
            </button>
            {editable && (
              <button
                type="button"
                onClick={() => setGenOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md hover:bg-[#132844] whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Financial Report
              </button>
            )}
          </div>
        }
      />

      {!editable && <ReadOnlyBanner roleLabel={ROLE_PERMISSIONS[role].label} />}

      {/* CSV Data Exports (Google Sheets / AppSheet interoperable) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Structured Table Exports (CSV / Google Sheets Ready)</h2>
            <p className="text-xs text-slate-500">Download normalized relational tables for external audit or Google Sheets import</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Customers (CRM)', file: 'apex_customers.csv', data: db.customers as unknown as Record<string, unknown>[] },
            { label: 'Sales Leads', file: 'apex_leads.csv', data: db.leads as unknown as Record<string, unknown>[] },
            { label: 'Subscriptions', file: 'apex_subscriptions.csv', data: db.subscriptions as unknown as Record<string, unknown>[] },
            { label: 'Revenue Transactions', file: 'apex_revenue.csv', data: db.revenueTransactions as unknown as Record<string, unknown>[] },
            { label: 'Expense Transactions', file: 'apex_expenses.csv', data: db.expenseTransactions as unknown as Record<string, unknown>[] },
            { label: 'Marketing Campaigns', file: 'apex_campaigns.csv', data: db.marketingCampaigns as unknown as Record<string, unknown>[] },
          ].map((exp) => (
            <button
              key={exp.file}
              type="button"
              onClick={() => downloadCsv(exp.file, exp.data)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              {exp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Archive + Executive Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden no-print">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xs font-semibold text-slate-800">Generated Financial Reports ({db.financialReports.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {db.financialReports.map((rpt) => {
              const active = previewReport?.id === rpt.id;
              return (
                <button
                  key={rpt.id}
                  type="button"
                  onClick={() => setPreviewReport(rpt)}
                  className={`w-full text-left p-4 transition-colors ${
                    active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono text-slate-500">{rpt.id} · {rpt.periodType}</span>
                    <span className="font-mono text-slate-500">{rpt.generatedDate}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1">{rpt.title}</div>
                  <div className="flex items-center gap-4 mt-2 text-xs font-mono tabular-nums">
                    <span className="text-slate-700">Rev: {formatINR(rpt.totalRevenue)}</span>
                    <span className={rpt.operatingSurplus >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                      Surplus: {formatINR(rpt.operatingSurplus)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Executive Printable Board Summary */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          {previewReport ? (
            <>
              <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-blue-700">Apex Global Technologies · Executive Financial Summary</div>
                  <h2 className="text-lg font-semibold text-slate-900 mt-0.5">{previewReport.title}</h2>
                  <div className="text-xs text-slate-500 mt-1">
                    {previewReport.id} · Period: {previewReport.periodLabel} · Generated {previewReport.generatedDate} by {getUserName(previewReport.generatedById)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-slate-500">Total Revenue</div>
                  <div className="text-base font-mono tabular-nums font-semibold text-slate-900 mt-1">
                    {formatINR(previewReport.totalRevenue)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-slate-500">Total Expenses</div>
                  <div className="text-base font-mono tabular-nums font-semibold text-slate-900 mt-1">
                    {formatINR(previewReport.totalExpenses)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-slate-500">Operating Surplus</div>
                  <div className={`text-base font-mono tabular-nums font-semibold mt-1 ${previewReport.operatingSurplus >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatINR(previewReport.operatingSurplus)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                  <div className="text-slate-500">Contribution Margin</div>
                  <div className="text-base font-mono tabular-nums font-semibold text-blue-700 mt-1">
                    {formatPct(previewReport.contributionMarginPct)}
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="font-semibold text-slate-900">Executive Commentary</div>
                <p className="text-slate-600 leading-relaxed">{previewReport.summaryNotes}</p>
              </div>

              <div className="border-t border-slate-200 pt-4 text-xs">
                <div className="font-semibold text-slate-900 mb-2">Live Platform Snapshot Context</div>
                <div className="grid grid-cols-2 gap-y-1.5 font-mono tabular-nums">
                  <span className="font-sans text-slate-600">Current Active MRR / ARR</span>
                  <span className="text-right text-slate-900">{formatINR(metrics.live.mrr)} / {formatINR(metrics.live.arr)}</span>
                  <span className="font-sans text-slate-600">Active Paying Customers</span>
                  <span className="text-right text-slate-900">{metrics.live.paidCustomers} (Break-even: {metrics.live.breakEvenCustomersActual})</span>
                  <span className="font-sans text-slate-600">Customer Acquisition Cost (CAC)</span>
                  <span className="text-right text-slate-900">{formatINR(metrics.live.cac)}</span>
                  <span className="font-sans text-slate-600">Avg Weekly Reporting Time Saved</span>
                  <span className="text-right text-blue-700 font-semibold">{metrics.live.avgReportingHoursSaved.toFixed(1)} hrs/week</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-500">Select a report on the left to inspect its executive board summary.</div>
          )}
        </div>
      </div>

      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Generate Executive Financial Report">
        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Period Type</label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as ReportPeriodType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Period Label *</label>
            <input
              required
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="e.g., Nov 2026 or Q3 FY26-27"
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Executive Notes</label>
            <textarea
              rows={3}
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder="Optional highlights for board review..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setGenOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-md">
              Generate & Save Report
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
