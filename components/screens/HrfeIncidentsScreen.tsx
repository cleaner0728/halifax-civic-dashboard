import type { HrmItem } from '@/lib/fetchers/hrm';

export default function HrfeIncidentsScreen({ incidents }: { incidents: HrmItem[] }) {
  return (
    <div className="pt-[88px] pb-8 min-h-screen">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-red-500 via-orange-600 to-amber-600 dark:from-red-800 dark:via-orange-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                Halifax Regional Fire &amp; Emergency
              </p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">HRFE Incidents</h2>
              <p className="text-base text-white/70 mt-1">
                Past 6 hours · {incidents.length} incident{incidents.length !== 1 ? 's' : ''} ·{' '}
                <a
                  href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  HRFE Incident Feed
                </a>
              </p>
            </div>
            <div className="text-5xl">🚒</div>
          </div>
        </div>

        <div className="space-y-3 pb-16">
          {incidents.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-lg font-medium">No active incidents.</p>
              <p className="text-sm mt-1">All clear in the Halifax region.</p>
            </div>
          ) : (
            incidents.map((item, index) => (
              <article
                key={index}
                className="bg-card rounded-xl border border-border hover:border-red-500/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-2">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors leading-snug"
                  >
                    {item.title}
                  </a>
                  <p className="text-xs text-foreground/40 mt-1 font-mono">
                    {item.pubDate
                      ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' })
                      : 'Unknown'}
                  </p>
                  {item.description && (
                    <p className="text-foreground/60 mt-1 text-base leading-relaxed">{item.description}</p>
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
