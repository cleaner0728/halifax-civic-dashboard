import type { TransitDetour } from '@/lib/fetchers/transit';

type Props = {
  detours: TransitDetour[];
  hasRecent: boolean;
};

export default function TransitDisruptionScreen({ detours, hasRecent }: Props) {
  return (
    <div data-screen-scroll className="pt-[140px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 dark:from-amber-900 dark:via-orange-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Halifax Transit</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">Transit Disruption</h2>
              <p className="text-base text-white/70 mt-1">
                Active detours · {detours.length} disruption{detours.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-5xl">🚌</div>
          </div>
        </div>

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
                      {detour.summary}
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
