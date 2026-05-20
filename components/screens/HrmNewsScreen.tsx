import type { HrmItem } from '@/lib/fetchers/hrm';

type Props = {
  items: HrmItem[];
  dateLabel: string;
};

export default function HrmNewsScreen({ items, dateLabel }: Props) {
  return (
    <div data-screen-scroll className="pt-[88px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 dark:from-emerald-800 dark:via-teal-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                Halifax Regional Municipality
              </p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">HRM News</h2>
              <p className="text-base text-white/70 mt-1">Municipal updates · {dateLabel}</p>
            </div>
            <div className="text-5xl">🏛️</div>
          </div>
        </div>

        <div className="space-y-4 pb-16">
          {items.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-lg font-medium">No HRM news published today.</p>
              <p className="text-sm mt-1">Check back later for updates from Halifax City Hall.</p>
            </div>
          ) : (
            items.map((item, index) => (
              <article
                key={index}
                className="bg-card rounded-xl border border-border hover:border-emerald-500/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-2">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors leading-snug"
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
