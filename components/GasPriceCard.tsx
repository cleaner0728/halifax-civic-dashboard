import type { GasPriceData } from '@/lib/fetchers/gas';

type Props = {
  data: GasPriceData;
};

function Sparkline({ history }: { history: GasPriceData['history'] }) {
  if (history.length < 2) return null;

  const recent = history.slice(-12);
  const W = 300;
  const H = 52;
  const PAD = 6;

  const values = recent.map(e => e.regular);
  const minVal = Math.min(...values) - 1;
  const maxVal = Math.max(...values) + 1;
  const range = maxVal - minVal || 1;

  const toX = (i: number) => PAD + (i / (recent.length - 1)) * (W - PAD * 2);
  const toY = (v: number) => H - PAD - ((v - minVal) / range) * (H - PAD * 2);

  const linePoints = recent.map((e, i) => `${toX(i).toFixed(1)},${toY(e.regular).toFixed(1)}`).join(' ');
  const fillPoints = `${PAD},${H} ${linePoints} ${toX(recent.length - 1).toFixed(1)},${H}`;

  const lastX = toX(recent.length - 1);
  const lastY = toY(recent[recent.length - 1].regular);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <polygon points={fillPoints} fill="rgba(251,191,36,0.12)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="rgb(234,179,8)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r="4" fill="rgb(234,179,8)" />
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

        <p className="text-xs text-foreground/40 mt-0.5">
          Diesel&nbsp;{current.diesel.toFixed(1)} ¢/L
        </p>
      </div>

      <div className="px-2 pb-3">
        {history.length > 1 ? (
          <Sparkline history={history} />
        ) : (
          <p className="text-[10px] text-foreground/30 text-center pb-1">
            Chart builds weekly — check back next Saturday
          </p>
        )}
      </div>
    </div>
  );
}
