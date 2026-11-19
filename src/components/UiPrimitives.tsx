import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, Clock, MinusCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: { value: string; positive: boolean } | null;
  highlight?: 'default' | 'positive' | 'negative' | 'accent';
}

export function KpiCard({ label, value, subtext, trend, highlight = 'default' }: KpiCardProps) {
  const valueColor =
    highlight === 'positive'
      ? 'text-emerald-700'
      : highlight === 'negative'
      ? 'text-red-700'
      : highlight === 'accent'
      ? 'text-blue-700'
      : 'text-slate-900';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 leading-snug">{label}</span>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums font-medium whitespace-nowrap shrink-0 ${
              trend.positive ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {trend.positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trend.value}
          </span>
        )}
      </div>
      <div className={`text-xl font-semibold font-mono tabular-nums tracking-tight ${valueColor}`}>
        {value}
      </div>
      {subtext && <div className="text-xs text-slate-500 leading-snug">{subtext}</div>}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

export function SemanticStatus({
  status,
  tone,
}: {
  status: string;
  tone?: 'positive' | 'warning' | 'negative' | 'neutral' | 'accent';
}) {
  const resolved =
    tone ??
    (status.match(/Paid|Active|Completed|Received|Approved|Validated|Converted/i)
      ? 'positive'
      : status.match(/Overdue|Cancelled|Lost|Inactive/i)
      ? 'negative'
      : status.match(/Pending|Expiring|Trial|Conditional|In Progress|Negotiation|Scheduled/i)
      ? 'warning'
      : 'neutral');

  const colorMap = {
    positive: 'text-emerald-700',
    warning: 'text-amber-700',
    negative: 'text-red-700',
    accent: 'text-blue-700',
    neutral: 'text-slate-600',
  };

  const Icon =
    resolved === 'positive'
      ? CheckCircle2
      : resolved === 'negative'
      ? AlertCircle
      : resolved === 'warning'
      ? Clock
      : MinusCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${colorMap[resolved]}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className={`bg-white border border-slate-200 rounded-lg w-full ${maxWidth} shadow-xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-10 text-center flex flex-col items-center justify-center gap-3">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="text-xs text-slate-500 max-w-md">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ReadOnlyBanner({ roleLabel }: { roleLabel: string }) {
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-xs text-slate-700 flex items-center justify-between gap-3">
      <span>
        Signed in as <strong className="font-semibold text-slate-900">{roleLabel}</strong> — this module is in read-only view for your role.
      </span>
    </div>
  );
}
