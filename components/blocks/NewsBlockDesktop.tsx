import type { NewsItem } from '@/lib/fetchers/news';
import { formatRelative } from '@/lib/date';
import { IconInbox } from '@/components/icons';

type Props = {
  items: NewsItem[];
};

// Desktop-only News tile grid. Each card is roughly square so the grid tiles
// densely across any viewport — at 1280px (4 cols), 1920px (~6 cols), 3840px
// (~12+ cols). Mobile NewsBlock is left untouched per the mobile-untouched
// policy and continues to render the vertical stack on FeedScreen.
export default function NewsBlockDesktop({ items }: Props) {
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
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
      {items.map((item, index) => (
        <article
          key={index}
          className="aspect-square bg-card rounded-xl border border-border hover:border-blue-400/40 shadow-sm hover:shadow-md transition-all overflow-hidden"
        >
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col h-full p-4"
          >
            <p className="text-[11px] text-foreground/40 font-mono mb-2 shrink-0">
              {item.source && (
                <span className="text-blue-500 dark:text-blue-400 font-semibold mr-2">{item.source}</span>
              )}
              {formatRelative(item.pubDate) || 'Unknown'}
            </p>

            <h3 className="text-base font-semibold text-foreground group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors leading-snug line-clamp-3 shrink-0">
              {item.title}
            </h3>

            <p className="text-sm text-foreground/60 mt-2 leading-relaxed line-clamp-5 flex-1 min-h-0">
              {item.contentSnippet}
            </p>

            <p className="mt-3 text-xs font-semibold text-blue-500 dark:text-blue-400 inline-flex items-center gap-1 group-hover:gap-2 transition-all shrink-0">
              Read on {item.source || 'source'}
              <span aria-hidden>→</span>
            </p>
          </a>
        </article>
      ))}
    </div>
  );
}
