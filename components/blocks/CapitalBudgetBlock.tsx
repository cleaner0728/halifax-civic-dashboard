// 2026/27 HRM Draft Capital Budget data, sourced from:
// https://cdn.halifax.ca/sites/default/files/documents/city-hall/budget-finances/2026-27-draft-capital-budget-book-digital-version.pdf
//
// Figures are in thousands of CAD (as published). The component formats
// them as millions for readability.

const PDF_URL =
  'https://cdn.halifax.ca/sites/default/files/documents/city-hall/budget-finances/2026-27-draft-capital-budget-book-digital-version.pdf';

// 2026/27 single-year capital plan breakdown (Base + Strategic combined).
// "Other" rolls up Business Systems, Traffic & Streetlights, District
// Capital Funds, and HalifACT Projects.
const CATEGORIES = [
  {
    label: 'Roads & Active Transport',
    amount: 76_404 + 74_760, // Base Roads + Strategic Integrated Mobility
    color: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    note: 'includes Integrated Mobility Plan',
  },
  {
    label: 'Buildings & Facilities',
    amount: 63_596,
    color: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    note: undefined,
  },
  {
    label: 'Vehicles & Equipment',
    amount: 46_425,
    color: 'bg-violet-500',
    textColor: 'text-violet-600 dark:text-violet-400',
    note: undefined,
  },
  {
    label: 'Outdoor Recreation',
    amount: 18_300,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    note: undefined,
  },
  {
    label: 'Significant Projects',
    amount: 4_600,
    color: 'bg-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400',
    note: undefined,
  },
  {
    label: 'Other',
    amount: 1_504 + 5_525 + 4_525 + 7_553 + 810, // District + Traffic + Biz Sys + Other Assets + HalifACT
    color: 'bg-foreground/25',
    textColor: 'text-foreground/50',
    note: 'Traffic, IT systems, HalifACT, etc.',
  },
] as const;

const TOTAL = CATEGORIES.reduce((s, c) => s + c.amount, 0); // 303,002

function fmt(thousands: number) {
  const m = thousands / 1000;
  return m >= 100
    ? `$${Math.round(m)}M`
    : `$${m.toFixed(1)}M`;
}

export default function CapitalBudgetBlock() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
              2026/27 Draft Capital Budget
            </p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              $303M
            </p>
            <p className="text-xs text-foreground/50 mt-0.5">
              226 active capital projects · Halifax Regional Municipality
            </p>
          </div>
          <a
            href={PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
          >
            Full PDF ↗
          </a>
        </div>

        {/* Stacked bar — proportional widths */}
        <div className="mt-3 flex h-3 rounded-full overflow-hidden gap-px">
          {CATEGORIES.map((c) => (
            <div
              key={c.label}
              className={`${c.color} transition-all`}
              style={{ width: `${(c.amount / TOTAL) * 100}%` }}
              title={`${c.label}: ${fmt(c.amount)}`}
            />
          ))}
        </div>
      </div>

      {/* Category rows */}
      <ul className="divide-y divide-border">
        {CATEGORIES.map((c) => {
          const pct = (c.amount / TOTAL) * 100;
          return (
            <li key={c.label} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm shrink-0 ${c.color}`} />
                  <span className="text-sm font-medium text-foreground truncate">
                    {c.label}
                  </span>
                  {c.note && (
                    <span className="hidden sm:inline text-[11px] text-foreground/35 truncate">
                      · {c.note}
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold shrink-0 ${c.textColor}`}>
                  {fmt(c.amount)}
                </span>
              </div>
              {/* Per-row bar */}
              <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                <div
                  className={`h-full rounded-full ${c.color} opacity-70`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer note */}
      <div className="px-4 py-2.5 border-t border-border">
        <p className="text-[11px] text-foreground/35 leading-snug">
          Base Capital $224M + Strategic Initiatives $80M.
          Figures in thousands as published; displayed in millions.
          4-Year plan total: $2.18B (2026/27–2029/30).
        </p>
      </div>
    </div>
  );
}
