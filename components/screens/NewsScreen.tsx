import Image from 'next/image';
import type { NewsItem } from '@/lib/fetchers/news';

type Props = {
  items: NewsItem[];
};

export default function NewsScreen({ items }: Props) {
  return (
    <div className="pt-[88px] pb-8 min-h-screen">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 dark:from-sky-900 dark:via-blue-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
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
              <article
                key={index}
                className="bg-card rounded-xl border border-border hover:border-foreground/15 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className={`flex ${item.imageUrl ? 'flex-col sm:flex-row' : ''}`}>
                  {item.imageUrl && (
                    <div className="relative h-52 sm:h-auto sm:min-h-[160px] sm:w-72 sm:shrink-0">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block absolute inset-0"
                      >
                        <Image
                          src={item.imageUrl}
                          alt={item.title || 'News image'}
                          fill
                          sizes="(min-width: 640px) 18rem, 100vw"
                          className="object-cover"
                        />
                      </a>
                    </div>
                  )}
                  <div className="p-2 flex-1 min-w-0">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-semibold text-foreground hover:text-blue-500 dark:hover:text-blue-400 transition-colors leading-snug"
                    >
                      {item.title}
                    </a>
                    <p className="text-xs text-foreground/40 mt-1 font-mono">
                      {item.source && <span className="text-blue-400 mr-2">{item.source}</span>}
                      {item.pubDate
                        ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' })
                        : 'Unknown'}
                    </p>
                    <p className="text-foreground/60 mt-1 text-base leading-relaxed">{item.contentSnippet}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
