import React, { useState } from 'react';
import { formatCompactINR, formatINR } from '../shared/financialUtils.ts';

interface MonthlyPoint {
  monthKey: string;
  label: string;
  revenue: number;
  totalExpenses: number;
  operatingSurplus: number;
  activeCustomers: number;
  activeSubscriptions: number;
  newCustomers: number;
}

export function RevenueExpenseChart({ data }: { data: MonthlyPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.revenue, d.totalExpenses, Math.abs(d.operatingSurplus))),
    100000
  );
  const yMax = Math.ceil(maxVal / 100000) * 100000;

  const width = 640;
  const height = 240;
  const padL = 62;
  const padR = 20;
  const padT = 20;
  const padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const groupW = innerW / Math.max(data.length, 1);
  const barW = Math.min(22, groupW * 0.28);

  const surplusPoints = data
    .map((d, i) => {
      const cx = padL + i * groupW + groupW / 2;
      const clamped = Math.max(0, d.operatingSurplus);
      const cy = padT + innerH - (clamped / yMax) * innerH;
      return `${cx},${cy}`;
    })
    .join(' ');

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#0B192C]" />
            Total Revenue
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-400" />
            Operating Expenses
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-emerald-600" />
            Operating Surplus
          </span>
        </div>
        {hoverIdx !== null && data[hoverIdx] && (
          <div className="text-xs font-mono tabular-nums text-slate-700">
            {data[hoverIdx].label}: Rev {formatINR(data[hoverIdx].revenue)} · Exp{' '}
            {formatINR(data[hoverIdx].totalExpenses)} · Surplus{' '}
            <span className={data[hoverIdx].operatingSurplus >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
              {formatINR(data[hoverIdx].operatingSurplus)}
            </span>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          const val = yMax * t;
          return (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                {formatCompactINR(val)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const revH = (d.revenue / yMax) * innerH;
          const expH = (d.totalExpenses / yMax) * innerH;
          return (
            <g
              key={d.monthKey}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <rect
                x={cx - barW - 2}
                y={padT + innerH - revH}
                width={barW}
                height={Math.max(revH, 2)}
                rx={2}
                fill={hoverIdx === i ? '#1D4ED8' : '#0B192C'}
              />
              <rect
                x={cx + 2}
                y={padT + innerH - expH}
                width={barW}
                height={Math.max(expH, 2)}
                rx={2}
                fill="#94A3B8"
              />
              <text x={cx} y={height - 10} textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
                {d.label}
              </text>
            </g>
          );
        })}

        {data.length > 1 && (
          <polyline fill="none" stroke="#16A34A" strokeWidth={2.2} points={surplusPoints} />
        )}
        {data.map((d, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const cy = padT + innerH - (Math.max(0, d.operatingSurplus) / yMax) * innerH;
          return (
            <circle
              key={`pt-${d.monthKey}`}
              cx={cx}
              cy={cy}
              r={hoverIdx === i ? 5 : 3.5}
              fill="#16A34A"
              stroke="#FFFFFF"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function CustomerSubscriptionChart({ data }: { data: MonthlyPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const maxCust = Math.max(...data.map((d) => Math.max(d.activeCustomers, d.activeSubscriptions)), 10);
  const yMax = Math.ceil(maxCust / 5) * 5 + 5;

  const width = 560;
  const height = 220;
  const padL = 40;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const stepX = innerW / Math.max(data.length - 1, 1);

  const subPoints = data
    .map((d, i) => {
      const x = padL + i * stepX;
      const y = padT + innerH - (d.activeSubscriptions / yMax) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  const custArea =
    data.length > 0
      ? `${padL},${padT + innerH} ` +
        data
          .map((d, i) => {
            const x = padL + i * stepX;
            const y = padT + innerH - (d.activeCustomers / yMax) * innerH;
            return `${x},${y}`;
          })
          .join(' ') +
        ` ${padL + (data.length - 1) * stepX},${padT + innerH}`
      : '';

  const custLine = data
    .map((d, i) => {
      const x = padL + i * stepX;
      const y = padT + innerH - (d.activeCustomers / yMax) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
            Active Customers
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#0B192C]" />
            Active Subscriptions
          </span>
        </div>
        {hoverIdx !== null && data[hoverIdx] && (
          <div className="text-xs font-mono tabular-nums text-slate-700">
            {data[hoverIdx].label}: {data[hoverIdx].activeCustomers} customers · {data[hoverIdx].activeSubscriptions} subs (+{data[hoverIdx].newCustomers} new)
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 0.5, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                {Math.round(yMax * t)}
              </text>
            </g>
          );
        })}

        {custArea && <polygon points={custArea} fill="rgba(29, 78, 216, 0.10)" />}
        {custLine && <polyline fill="none" stroke="#1D4ED8" strokeWidth={2.2} points={custLine} />}
        {subPoints && <polyline fill="none" stroke="#0B192C" strokeWidth={1.8} strokeDasharray="4 3" points={subPoints} />}

        {data.map((d, i) => {
          const x = padL + i * stepX;
          const y = padT + innerH - (d.activeCustomers / yMax) * innerH;
          return (
            <g
              key={d.monthKey}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <circle cx={x} cy={y} r={hoverIdx === i ? 5 : 3.5} fill="#1D4ED8" stroke="#FFFFFF" strokeWidth={1.5} />
              <text x={x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px] font-medium">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function BreakEvenChart({
  sellingPrice,
  variableCost,
  fixedCost,
  expectedCustomers,
  actualCustomers,
}: {
  sellingPrice: number;
  variableCost: number;
  fixedCost: number;
  expectedCustomers: number;
  actualCustomers: number;
}) {
  const maxQ = Math.max(expectedCustomers + 5, actualCustomers + 5, 25);
  const maxY = Math.max(sellingPrice * maxQ, fixedCost + variableCost * maxQ, 500000);
  const contrib = Math.max(sellingPrice - variableCost, 1);
  const breakEvenQ = fixedCost / contrib;
  const breakEvenY = breakEvenQ * sellingPrice;

  const width = 580;
  const height = 240;
  const padL = 62;
  const padR = 24;
  const padT = 18;
  const padB = 34;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const toX = (q: number) => padL + (q / maxQ) * innerW;
  const toY = (val: number) => padT + innerH - (val / maxY) * innerH;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-700" />
            Revenue ({formatINR(sellingPrice)}/cust)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-red-600" />
            Total Cost (Fixed + {formatINR(variableCost)}/cust)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-400" />
            Fixed Cost ({formatINR(fixedCost)})
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums text-emerald-700 font-medium">
          Break-Even: {breakEvenQ.toFixed(1)} (~{Math.ceil(breakEvenQ)} customers) · Current: {actualCustomers}
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                {formatCompactINR(maxY * t)}
              </text>
            </g>
          );
        })}

        {/* Fixed cost line */}
        <line
          x1={toX(0)}
          y1={toY(fixedCost)}
          x2={toX(maxQ)}
          y2={toY(fixedCost)}
          stroke="#94A3B8"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />

        {/* Total cost line */}
        <line
          x1={toX(0)}
          y1={toY(fixedCost)}
          x2={toX(maxQ)}
          y2={toY(fixedCost + variableCost * maxQ)}
          stroke="#DC2626"
          strokeWidth={2}
        />

        {/* Revenue line */}
        <line
          x1={toX(0)}
          y1={toY(0)}
          x2={toX(maxQ)}
          y2={toY(sellingPrice * maxQ)}
          stroke="#1D4ED8"
          strokeWidth={2.4}
        />

        {/* Actual customers vertical marker */}
        {actualCustomers <= maxQ && (
          <g>
            <line
              x1={toX(actualCustomers)}
              y1={padT}
              x2={toX(actualCustomers)}
              y2={padT + innerH}
              stroke="#16A34A"
              strokeWidth={1.4}
              strokeDasharray="3 3"
            />
            <circle cx={toX(actualCustomers)} cy={toY(sellingPrice * actualCustomers)} r={4.5} fill="#16A34A" />
          </g>
        )}

        {/* Break-even intersection */}
        {breakEvenQ <= maxQ && (
          <g>
            <circle cx={toX(breakEvenQ)} cy={toY(breakEvenY)} r={5.5} fill="#0B192C" stroke="#FFFFFF" strokeWidth={2} />
            <text
              x={toX(breakEvenQ) + 8}
              y={toY(breakEvenY) - 6}
              className="fill-slate-900 text-[10px] font-mono font-semibold"
            >
              BEP ({Math.ceil(breakEvenQ)})
            </text>
          </g>
        )}

        {[0, 5, 10, 15, 20, maxQ].map((q) => (
          <text key={q} x={toX(q)} y={height - 10} textAnchor="middle" className="fill-slate-500 text-[10px] font-mono">
            {q}
          </text>
        ))}
      </svg>
    </div>
  );
}
