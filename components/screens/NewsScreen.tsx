import type { NewsItem } from '@/lib/fetchers/news';
import { formatRelative } from '@/lib/date';

type Props = {
  items: NewsItem[];
};

export default function NewsScreen({ items }: Props) {
  return (
    <div className="pt-20 pb-4 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 dark:from-sky-900 dark:via-blue-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">News</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">Latest Headlines</h2>
              <p className="text-base text-white/70 mt-1">
                {items.length} {items.length === 1 ? 'story' : 'stories'} · past 8 hours · CBC · Examiner · Global · SaltWire · CTV
              </p>
            </div>
            <div className="text-5xl">📰</div>
          </div>
        </div>

        <div className="space-y-5 pb-16">
          {items.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-lg font-medium">No news in the past 8 hours.</p>
            </div>
          ) : (
            items.map((item, index) => (
              // Whole card is a single <a> so any tap lands on the article.
              // Two inner <a> tags (one on the image, one on the title) used
              // to fight for the tap zone and left the snippet/meta as dead
              // space — users read the snippet, didn't realise there was a
              // full article behind it, and bailed. The "Read on {source} →"
              // affordance at the bottom makes the call-to-action explicit;
              // `group-hover` on the title + arrow gives a consistent signal
              // across desktop hover and (via :active) mobile press.
              <article
                key={index}
                className="bg-card rounded-xl border border-border hover:border-foreground/15 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-3"
                >
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-foreground/40 mt-1 font-mono">
                    {item.source && <span className="text-blue-400 mr-2">{item.source}</span>}
                    {formatRelative(item.pubDate) || 'Unknown'}
                  </p>
                  <p className="text-foreground/60 mt-1 text-base leading-relaxed">{item.contentSnippet}</p>
                  <p className="mt-3 text-sm font-medium text-blue-500 dark:text-blue-400 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    Read on {item.source || 'source'}
                    <span aria-hidden>→</span>
                  </p>
                </a>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
