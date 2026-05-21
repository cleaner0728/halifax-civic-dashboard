import type { TransitDetour, FerryAlert, TransitAdjustment } from '@/lib/fetchers/transit';

type Props = {
  detours: TransitDetour[];
  ferryAlerts: FerryAlert[];
  hasRecent: boolean;
  adjustments: TransitAdjustment | null;
};

// Inline pill matching the Affected-Routes badge style. Reused anywhere a
// route number appears in flowing text so the dashboard stays visually
// consistent: see a bus-route number → it's always this same amber chip.
function RoutePill({ route }: { route: string }) {
  return (
    <span className="inline-block whitespace-nowrap bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md px-2 py-0.5 text-sm font-mono font-bold align-baseline mx-0.5">
      {route}
    </span>
  );
}

// Scan a string for "Route(s) <num>[, <num>...]" clusters and replace each
// number with a RoutePill, leaving surrounding text untouched. Returns a
// React fragment of mixed strings + pills.
//
// Why the regex anchors on the word "Route(s)": the bullets contain
// unrelated numbers ("May 18, 2026", "Phase 2", etc.) we definitely don't
// want pillified. Requiring the preceding "Route(s)" keyword is the
// simplest reliable filter.
function highlightRoutes(text: string): React.ReactNode {
  const re = /\bRoutes?\s+(\d+[A-Z]?(?:(?:\s*,\s*|\s+and\s+)\d+[A-Z]?)*)\b/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) nodes.push(text.slice(lastIdx, match.index));
    const fullMatch = match[0];
    const numbersStr = match[1];
    const word = fullMatch.slice(0, fullMatch.indexOf(numbersStr)).trimEnd();
    nodes.push(`${word} `);
    // Split keeping the separators (", " or " and ") so the rendered text
    // reads naturally: "Routes [1], [8] and [192]".
    const parts = numbersStr.split(/(\s*,\s*|\s+and\s+)/);
    parts.forEach((part, i) => {
      if (/^\d+[A-Z]?$/.test(part)) {
        nodes.push(<RoutePill key={`${match!.index}-${i}`} route={part} />);
      } else {
        nodes.push(part);
      }
    });
    lastIdx = match.index + fullMatch.length;
  }
  if (lastIdx < text.length) nodes.push(text.slice(lastIdx));
  return <>{nodes}</>;
}

export default function TransitDisruptionScreen({ detours, ferryAlerts, hasRecent, adjustments }: Props) {
  return (
    <div className="pt-[88px] pb-8 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 dark:from-amber-900 dark:via-orange-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Halifax Transit</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">Service Disruptions and Adjustments</h2>
            </div>
            <div className="text-5xl">🚌</div>
          </div>
        </div>

        {adjustments && (
          // Service adjustments card. Shown only when the upstream page has
          // been edited within the last 30 days (per its RSS feed) — see
          // fetchTransitAdjustments. Same amber palette as the detour
          // cards below: this whole tab is "Halifax Transit", and one
          // colour family keeps the page reading as a single surface.
          <article className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden mb-6">
            <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
              <span className="text-xl">📅</span>
              <h3 className="font-bold text-foreground leading-snug">
                Upcoming Service Changes · {adjustments.dateLabel}
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {adjustments.intro && (
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {highlightRoutes(adjustments.intro)}
                </p>
              )}
              {adjustments.bullets.length > 0 && (
                <ul className="list-disc pl-5 space-y-2 text-sm text-foreground/70 leading-relaxed">
                  {adjustments.bullets.map((b, i) => (
                    <li key={i}>{highlightRoutes(b)}</li>
                  ))}
                </ul>
              )}
              <a
                href={adjustments.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-amber-600 dark:text-amber-400 hover:underline"
              >
                → Full route-by-route details on halifax.ca
              </a>
            </div>
          </article>
        )}

        {ferryAlerts.length > 0 && (
          <div className="space-y-3 mb-6">
            {ferryAlerts.map((alert, i) => (
              <article
                key={i}
                className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="px-4 py-3 bg-sky-500/10 border-b border-sky-500/20 flex items-center gap-2">
                  <span className="text-xl">⛴️</span>
                  <h3 className="font-bold text-foreground leading-snug">{alert.title}</h3>
                </div>
                <div className="p-4 space-y-3">
                  {alert.body && (
                    <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">
                      {highlightRoutes(alert.body)}
                    </p>
                  )}
                  {alert.moreDetailsUrl && (
                    <a
                      href={alert.moreDetailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      → More details on halifax.ca
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="space-y-4 pb-16">
          {detours.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-lg font-medium">No active detours.</p>
              <p className="text-sm mt-1">Halifax Transit is running on regular routes.</p>
            </div>
          ) : (
            detours.map((detour, index) => (
              <article
                key={index}
                className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                  <span className="text-xl">🚌</span>
                  <h3 className="font-bold text-foreground leading-snug">{detour.title}</h3>
                </div>

                <div className="p-4 space-y-4">
                  <div className="flex flex-wrap gap-6">
                    {(detour.date || detour.startDate) && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                          {detour.startDate ? 'Start Date' : 'Date'}
                        </div>
                        <div className="text-xl font-bold text-foreground">
                          📅 {detour.startDate ?? detour.date}
                        </div>
                      </div>
                    )}
                    {detour.endDate && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                          End Date
                        </div>
                        <div className="text-xl font-bold text-foreground">📅 {detour.endDate}</div>
                      </div>
                    )}
                    {detour.time && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                          Time
                        </div>
                        <div className="text-xl font-bold text-amber-500 dark:text-amber-400">⏰ {detour.time}</div>
                      </div>
                    )}
                  </div>

                  {detour.location && <p className="text-sm text-foreground/60">📍 {detour.location}</p>}

                  {detour.routes && (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-2">
                        Affected Routes
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {detour.routes
                          .split(',')
                          .map((r) => r.trim())
                          .filter(Boolean)
                          .map((route) => (
                            <span
                              key={route}
                              className="inline-block bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md px-2.5 py-0.5 text-base font-mono font-bold"
                            >
                              {route}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {detour.summary && (
                    <p className="text-sm text-foreground/50 leading-relaxed border-t border-border/50 pt-3">
                      {highlightRoutes(detour.summary)}
                    </p>
                  )}

                  {hasRecent && (
                    <a
                      href="https://www.halifax.ca/transportation/halifax-transit/service-disruptions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      → View source on halifax.ca
                    </a>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
