import type { NewsItem } from '@/lib/fetchers/news';
import { formatRelative } from '@/lib/date';
import { IconInbox } from '@/components/icons';

type Props = {
  items: NewsItem[];
};

export default function NewsBlock({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 text-foreground/40">
        <IconInbox className="w-8 h-8 mb-2 text-foreground/25" />
        <p className="text-base font-medium">No news yet today.</p>
        <p className="text-sm mt-1 text-foreground/35">Check back later — stories build through the day.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
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
      ))}
    </div>
  );
}
