import type { GasPriceData } from '@/lib/fetchers/gas';

type Props = {
  data: GasPriceData;
};

// SVG viewBox dimensions
const W = 560;
const H = 130;
const ML = 44; // left margin for Y-axis labels
const MR = 38; // right margin for current-price label
const MT = 10; // top margin
const MB = 22; // bottom margin for X-axis labels
const CW = W - ML - MR;
const CH = H - MT - MB;

function GasPriceChart({ history }: { history: GasPriceData['history'] }) {
  // Anchor the window to the latest data point's date so SSR and client
  // hydration produce identical SVG coordinates regardless of when each runs.
  const sorted = history.slice().sort((a, b) => a.date.localeCompare(b.date));
  const lastDateStr = sorted.length > 0 ? sorted[sorted.length - 1].date : new Date().toISOString().split('T')[0];
  const end = new Date(lastDateStr + 'T23:59:59Z');
  const start = new Date(end);
  start.setMonth(start.getMonth() - 6);

  const inWindow = history.filter(e => new Date(e.date + 'T12:00:00Z') >= start);
  // If fewer than 2 points fall in the 6-month window, show whatever we have
  const pts = (inWindow.length >= 2 ? inWindow : history)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  if (pts.length < 2) return null;

  const toX = (dateStr: string) => {
    const t = new Date(dateStr + 'T12:00:00Z').getTime();
    return ML + ((t - start.getTime()) / (end.getTime() - start.getTime())) * CW;
  };

  const prices = pts.map(e => e.regular);
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const minP = Math.floor((rawMin - 5) / 10) * 10;
  const maxP = Math.ceil((rawMax + 5) / 10) * 10;
  const range = maxP - minP || 1;

  const toY = (p: number) => MT + CH - ((p - minP) / range) * CH;

  // Y-axis ticks every 10 ¢
  const yTicks: number[] = [];
  for (let p = minP; p <= maxP; p += 10) yTicks.push(p);

  // Month labels — first of each month inside the window
  const months: { x: number; label: string }[] = [];
  const mCur = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (mCur <= end) {
    const x = toX(mCur.toISOString().split('T')[0]);
    const label = mCur.toLocaleDateString('en-US', { month: 'short' });
    months.push({ x, label });
    mCur.setMonth(mCur.getMonth() + 1);
  }

  const linePoints = pts
    .map(e => `${toX(e.date).toFixed(1)},${toY(e.regular).toFixed(1)}`)
    .join(' ');

  const firstX = toX(pts[0].date).toFixed(1);
  const lastPt = pts[pts.length - 1];
  const lastX = toX(lastPt.date);
  const lastY = toY(lastPt.regular);
  const fillPoints = `${firstX},${MT + CH} ${linePoints} ${lastX.toFixed(1)},${MT + CH}`;

  // Diesel line — only if real values exist (diesel ≠ 999.9)
  const dieselPts = pts.filter(e => e.diesel < 500);
  const dieselLine =
    dieselPts.length >= 2
      ? dieselPts.map(e => `${toX(e.date).toFixed(1)},${toY(e.diesel).toFixed(1)}`).join(' ')
      : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gas price history chart">
      {/* Horizontal gridlines + Y-axis labels */}
      {yTicks.map(p => (
        <g key={p}>
          <line
            x1={ML} y1={toY(p)} x2={ML + CW} y2={toY(p)}
            stroke="currentColor" strokeOpacity="0.07" strokeWidth="1" strokeDasharray="4,3"
          />
          <text
            x={ML - 5} y={toY(p)}
            textAnchor="end" dominantBaseline="middle"
            fontSize="9" fill="currentColor" fillOpacity="0.45"
          >
            {p}
          </text>
        </g>
      ))}

      {/* Vertical month lines + X-axis labels */}
      {months.map((m, i) => (
        <g key={i}>
          <line
            x1={m.x} y1={MT} x2={m.x} y2={MT + CH}
            stroke="currentColor" strokeOpacity="0.06" strokeWidth="1"
          />
          <text
            x={m.x} y={MT + CH + 13}
            textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.45"
          >
            {m.label}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />

      {/* Area fill */}
      <polygon points={fillPoints} fill="rgba(234,179,8,0.10)" />

      {/* Regular price line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke="rgb(234,179,8)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Diesel price line */}
      {dieselLine && (
        <polyline
          points={dieselLine}
          fill="none"
          stroke="rgb(148,163,184)"
          strokeWidth="1.5"
          strokeDasharray="4,2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.7"
        />
      )}

      {/* Data point dots with title tooltips */}
      {pts.map(e => (
        <circle key={e.date} cx={toX(e.date)} cy={toY(e.regular)} r="3" fill="rgb(234,179,8)" fillOpacity="0.9">
          <title>{e.date}: {e.regular.toFixed(1)} ¢/L regular</title>
        </circle>
      ))}

      {/* Latest price — larger dot + label */}
      <circle cx={lastX} cy={lastY} r="4.5" fill="rgb(234,179,8)" />
      <text
        x={lastX + 7} y={lastY}
        dominantBaseline="middle" fontSize="11" fontWeight="700"
        fill="rgb(202,138,4)"
      >
        {lastPt.regular.toFixed(1)}
      </text>
    </svg>
  );
}

export default function GasPriceCard({ data }: Props) {
  const history = data?.history ?? [];
  if (history.length === 0) return null;

  const current = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const diff = previous !== null ? +(current.regular - previous.regular).toFixed(1) : null;

  const effectiveDate = new Date(current.date + 'T12:00:00Z').toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });

  const hasRealDiesel = current.diesel < 500;

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm mb-6 overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-medium">⛽ Gas Price</p>
            <p className="text-[10px] text-foreground/40 mt-0.5">Zone 1 · Halifax · max regulated</p>
          </div>
          <p className="text-[10px] text-foreground/35 mt-0.5">eff. {effectiveDate}</p>
        </div>

        <div className="flex items-baseline gap-2 mt-2 flex-wrap">
          <span className="text-3xl font-bold tracking-tight tabular-nums">{current.regular.toFixed(1)}</span>
          <span className="text-sm text-foreground/50">¢/L regular</span>
          {diff !== null && (
            <span className={`text-xs font-semibold ml-auto ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-emerald-500' : 'text-foreground/40'}`}>
              {diff > 0 ? '▲' : diff < 0 ? '▼' : '—'}&nbsp;{Math.abs(diff).toFixed(1)} vs prev
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-foreground/40">
            Diesel&nbsp;{hasRealDiesel ? `${current.diesel.toFixed(1)} ¢/L` : 'n/a'}
          </p>
          {history.length > 1 && (
            <p className="text-[10px] text-foreground/30 ml-auto">
              {history.length} weeks · 6-month view
            </p>
          )}
        </div>
      </div>

      <div className="px-3 pb-3">
        {history.length > 1 ? (
          <GasPriceChart history={history} />
        ) : (
          <p className="text-[10px] text-foreground/30 text-center pb-1">
            Chart builds weekly — check back next Saturday
          </p>
        )}
      </div>
    </div>
  );
}
