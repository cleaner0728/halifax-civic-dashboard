'use client';

import { useState } from 'react';
import type { GroceryPriceData, GroceryItem } from '@/lib/fetchers/grocery';

// SVG chart dimensions. MR is generous (44px) so the latest-price label
// can sit beyond the rightmost data point instead of overlapping the
// line — labels printed inline were colliding with the curve whenever
// the last segment trended toward the top-right of the chart.
const W = 560;
const H = 140;
const ML = 46;
const MR = 44;
const MT = 10;
const MB = 24;
const CW = W - ML - MR;
const CH = H - MT - MB;

// 1 lb in kg — used to render the supplementary "$/lb" hint for items
// the source publishes by the kilogram.
const KG_TO_LB = 0.453592;

function niceStep(range: number): number {
  if (range <= 1) return 0.25;
  if (range <= 3) return 0.5;
  if (range <= 8) return 1;
  if (range <= 20) return 2;
  if (range <= 50) return 5;
  return 10;
}

function GroceryChart({ item }: { item: GroceryItem }) {
  const pts = item.history;
  if (pts.length < 2) return null;

  const values = pts.map(p => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const step = niceStep(rawMax - rawMin);
  const minV = Math.floor((rawMin - step * 0.5) / step) * step;
  const maxV = Math.ceil((rawMax + step * 0.5) / step) * step;
  const range = maxV - minV || 1;

  // Map date string "YYYY-MM" to x coordinate
  const dates = pts.map(p => p.date);
  const first = dates[0];
  const last = dates[dates.length - 1];

  const dateToMs = (d: string) => new Date(d + '-01').getTime();
  const startMs = dateToMs(first);
  const endMs = dateToMs(last);
  const span = endMs - startMs || 1;

  const toX = (d: string) => ML + ((dateToMs(d) - startMs) / span) * CW;
  const toY = (v: number) => MT + CH - ((v - minV) / range) * CH;

  // Y-axis ticks
  const yTicks: number[] = [];
  for (let v = minV; v <= maxV + step * 0.01; v += step) {
    yTicks.push(parseFloat(v.toFixed(4)));
  }

  // X-axis: show a label every ~6 months to avoid crowding
  const monthLabels: { x: number; label: string }[] = [];
  const startDate = new Date(first + '-01');
  const endDate = new Date(last + '-01');
  const totalMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    endDate.getMonth() - startDate.getMonth();
  const step6 = totalMonths > 18 ? 6 : totalMonths > 9 ? 3 : 2;

  const cur = new Date(startDate);
  // round up to next even step6 month boundary
  while (cur <= endDate) {
    if (cur.getMonth() % step6 === 0) {
      const dStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      if (dStr >= first && dStr <= last) {
        monthLabels.push({
          x: toX(dStr),
          label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        });
      }
    }
    cur.setMonth(cur.getMonth() + 1);
  }

  const linePoints = pts.map(p => `${toX(p.date).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');
  const firstX = toX(pts[0].date).toFixed(1);
  const lastPt = pts[pts.length - 1];
  const lastX = toX(lastPt.date);
  const lastY = toY(lastPt.value);
  const fillPoints = `${firstX},${MT + CH} ${linePoints} ${lastX.toFixed(1)},${MT + CH}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${item.label} price history`}>
      {yTicks.map(v => (
        <g key={v}>
          <line
            x1={ML} y1={toY(v)} x2={ML + CW} y2={toY(v)}
            stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" strokeDasharray="4,3"
          />
          <text
            x={ML - 5} y={toY(v)}
            textAnchor="end" dominantBaseline="middle"
            fontSize="9" fill="currentColor" fillOpacity="0.45"
          >
            {v % 1 === 0 ? v : v.toFixed(2)}
          </text>
        </g>
      ))}

      {monthLabels.map((m, i) => (
        <g key={i}>
          <line
            x1={m.x} y1={MT} x2={m.x} y2={MT + CH}
            stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
          />
          <text
            x={m.x} y={MT + CH + 14}
            textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.45"
          >
            {m.label}
          </text>
        </g>
      ))}

      <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />

      <polygon points={fillPoints} fill="rgba(16,185,129,0.10)" />

      <polyline
        points={linePoints}
        fill="none"
        stroke="rgb(16,185,129)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {pts.map(p => (
        <circle key={p.date} cx={toX(p.date)} cy={toY(p.value)} r="2.5" fill="rgb(16,185,129)" fillOpacity="0.8">
          <title>{p.date}: ${p.value.toFixed(2)} {item.unit.replace('$/', '')}</title>
        </circle>
      ))}

      <circle cx={lastX} cy={lastY} r="4" fill="rgb(16,185,129)" />
      {/* Latest-price label sits to the RIGHT of the last data point,
          outside the chart's plotted area (we reserved MR=44 for this).
          Vertically centred on the point so a steep last-segment slope
          doesn't push the label into the line above or below. */}
      <text
        x={lastX + 6} y={lastY}
        textAnchor="start" dominantBaseline="middle"
        fontSize="10" fontWeight="700"
        fill="rgb(5,150,105)"
      >
        ${lastPt.value.toFixed(2)}
      </text>
    </svg>
  );
}

export default function GroceryPriceCard({ data }: { data: GroceryPriceData }) {
  const items = data?.items ?? [];
  const [selectedKey, setSelectedKey] = useState(items[0]?.key ?? '');

  if (items.length === 0) return null;

  const item = items.find(i => i.key === selectedKey) ?? items[0];
  const hist = item.history;
  const latest = hist[hist.length - 1];
  const prev = hist.length > 1 ? hist[hist.length - 2] : null;
  const diff = prev ? +(latest.value - prev.value).toFixed(2) : null;
  const pct = prev ? ((latest.value - prev.value) / prev.value * 100).toFixed(1) : null;

  const latestDate = latest
    ? new Date(latest.date + '-01').toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })
    : '';

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm mb-6 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-medium">🛒 Grocery Prices</p>
            <p className="text-[10px] text-foreground/40 mt-0.5">Nova Scotia avg · Stats Canada · monthly</p>
          </div>
          <p className="text-[10px] text-foreground/35" translate="no">{latestDate}</p>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {items.map(it => (
            <button
              key={it.key}
              onClick={() => setSelectedKey(it.key)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                it.key === item.key
                  ? 'bg-emerald-500 border-emerald-500 text-white font-semibold'
                  : 'border-border text-foreground/50 hover:border-foreground/30 hover:text-foreground/70'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>

        {/* Current price + change — translate="no" so Google Translate
            can't wrap these text nodes and break React re-renders on tab switch.
            For $/kg items we also surface an "≈ $X.XX /lb" hint, since most
            shoppers here still think in pounds at the meat counter. */}
        <div className="flex items-baseline gap-2 mt-3 flex-wrap" translate="no">
          <span className="text-3xl font-bold tracking-tight tabular-nums">
            ${latest.value.toFixed(2)}
          </span>
          <span className="text-sm text-foreground/50">{item.unit}</span>
          {item.unit === '$/kg' && (
            <span className="text-xs text-foreground/40 tabular-nums">
              ≈ ${(latest.value * KG_TO_LB).toFixed(2)} /lb
            </span>
          )}
          {diff !== null && pct !== null && (
            <span className={`text-xs font-semibold ml-auto ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-foreground/40'}`}>
              {diff > 0 ? '▲' : diff < 0 ? '▼' : '—'}&nbsp;${Math.abs(diff).toFixed(2)} ({Math.abs(parseFloat(pct))}%) vs prev mo
            </span>
          )}
        </div>
      </div>

      <div className="px-3 pb-3" translate="no">
        {hist.length > 1 ? (
          <GroceryChart key={item.key} item={item} />
        ) : (
          <p className="text-[10px] text-foreground/30 text-center pb-2">Not enough data yet</p>
        )}
      </div>
    </div>
  );
}
