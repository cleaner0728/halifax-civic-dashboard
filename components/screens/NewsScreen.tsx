import Image from 'next/image';
import type { NewsItem } from '@/lib/fetchers/news';

type Props = {
  items: NewsItem[];
};

// Wordpress/Jetpack CDNs (wp.com) and Global's WP install serve images with
// clean Content-Type headers — the browser can fetch them directly. Any
// other host (notably i.cbc.ca) gets Chrome's Opaque Response Blocking
// treatment when fetched cross-origin, so we route those through our
// own /api/img endpoint which fetches server-side and re-emits same-origin.
// Either way the result is plain `<img>`-style display, with no Vercel
// Image Optimization transformations getting billed.
const DIRECT_OK = /(?:^|\.)wp\.com$|^globalnews\.ca$/i;
function newsImageSrc(url: string): string {
  try {
    if (DIRECT_OK.test(new URL(url).hostname)) return url;
  } catch {
    return url;
  }
  return `/api/img?url=${encodeURIComponent(url)}`;
}

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
                {items.length} {items.length === 1 ? 'story' : 'stories'} · past 24 hours · CBC · Examiner · Global
              </p>
            </div>
            <div className="text-5xl">📰</div>
          </div>
        </div>

        <div className="space-y-5 pb-16">
          {items.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-lg font-medium">No news in the past 24 hours.</p>
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
                  className="group block"
                >
                  <div className={`flex ${item.imageUrl ? 'flex-col sm:flex-row' : ''}`}>
                    {item.imageUrl && (
                      <div className="relative h-52 sm:h-auto sm:min-h-[160px] sm:w-72 sm:shrink-0">
                        <Image
                          src={newsImageSrc(item.imageUrl)}
                          alt={item.title || 'News image'}
                          fill
                          sizes="(min-width: 640px) 18rem, 100vw"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="p-3 flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-foreground/40 mt-1 font-mono">
                        {item.source && <span className="text-blue-400 mr-2">{item.source}</span>}
                        {item.pubDate
                          ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' })
                          : 'Unknown'}
                      </p>
                      <p className="text-foreground/60 mt-1 text-base leading-relaxed">{item.contentSnippet}</p>
                      <p className="mt-3 text-sm font-medium text-blue-500 dark:text-blue-400 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read on {item.source || 'source'}
                        <span aria-hidden>→</span>
                      </p>
                    </div>
                  </div>
                </a>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
