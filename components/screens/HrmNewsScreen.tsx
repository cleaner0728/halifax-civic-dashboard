import type { HrmItem } from '@/lib/fetchers/hrm';
import { formatRelative } from '@/lib/date';

type Props = {
  items: HrmItem[];
  dateLabel: string;
};

export default function HrmNewsScreen({ items, dateLabel }: Props) {
  return (
    <div className="pt-20 pb-4 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 dark:from-emerald-800 dark:via-teal-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                Halifax Regional Municipality
              </p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">HRM News</h2>
              <p className="text-base text-white/70 mt-1">
                Municipal updates · {dateLabel} ·{' '}
                <a
                  href="https://www.halifax.ca/home/news"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  halifax.ca/news
                </a>
              </p>
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
            items.map((item) => (
              // Whole card → single <a>. Earlier the inner title was the
              // only clickable target, so taps on the description or the
              // timestamp landed on dead space. Users were hitting those
              // areas (especially the multi-line description on mobile)
              // and bouncing.
              <a
                key={item.link ?? item.title}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-card rounded-xl border border-border hover:border-emerald-500/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <article className="p-2">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-foreground/40 mt-1 font-mono">
                    {formatRelative(item.pubDate) || 'Unknown'}
                  </p>
                  {item.description && (
                    <p className="text-foreground/60 mt-1 text-base leading-relaxed">{item.description}</p>
                  )}
                </article>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
