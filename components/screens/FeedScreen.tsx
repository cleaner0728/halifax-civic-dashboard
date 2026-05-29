import NewsBlock from '@/components/blocks/NewsBlock';
import RedditBlock from '@/components/blocks/RedditBlock';
import { IconNews, IconMessages } from '@/components/icons';
import { formatRelative } from '@/lib/date';
import type { NewsItem } from '@/lib/fetchers/news';
import type { RedditPost } from '@/lib/fetchers/reddit';

type Props = {
  news: NewsItem[];
  redditPosts: RedditPost[];
  redditFetchedAt: string | null;
};

export default function FeedScreen({ news, redditPosts, redditFetchedAt }: Props) {
  return (
    <div className="pt-14 md:pt-24 pb-24 min-h-dvh">
      <div className="max-w-3xl mx-auto px-2 mt-2">
        {/* News first, then Reddit underneath — per design spec. Both render
            full-width single-column even on desktop because long-form text
            is most readable at one column. */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-widest">News</p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground mt-0.5">Latest Headlines</h2>
            <p className="text-sm text-foreground/50 mt-0.5">
              {news.length} {news.length === 1 ? 'story' : 'stories'} · past 8 hours
            </p>
          </div>
          <IconNews className="w-6 h-6 text-foreground/30 shrink-0" />
        </div>
        <NewsBlock items={news} />

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 mt-10 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-widest">Reddit</p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground mt-0.5">r/halifax</h2>
            <p className="text-sm text-foreground/50 mt-0.5">
              Top {redditPosts.length} hot
              {redditFetchedAt
                ? ` · last change ${formatRelative(redditFetchedAt)}`
                : ''}
            </p>
          </div>
          <IconMessages className="w-6 h-6 text-foreground/30 shrink-0" />
        </div>
        <RedditBlock posts={redditPosts} />
      </div>
    </div>
  );
}
