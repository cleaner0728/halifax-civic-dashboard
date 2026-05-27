import NewsBlock from '@/components/blocks/NewsBlock';
import RedditBlock from '@/components/blocks/RedditBlock';
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
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 dark:from-sky-900 dark:via-blue-900 dark:to-slate-900 text-white shadow-xl mb-4 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-white/70 uppercase tracking-widest">News</p>
              <h2 className="text-xl font-bold tracking-tight">Latest Headlines</h2>
              <p className="text-xs text-white/70 mt-0.5">
                {news.length} {news.length === 1 ? 'story' : 'stories'} · past 8 hours
              </p>
            </div>
            <div className="text-3xl shrink-0">📰</div>
          </div>
        </div>
        <NewsBlock items={news} />

        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 dark:from-orange-900 dark:via-red-900 dark:to-slate-900 text-white shadow-xl mt-10 mb-4 px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-white/70 uppercase tracking-widest">Reddit</p>
              <h2 className="text-xl font-bold tracking-tight">r/halifax</h2>
              <p className="text-xs text-white/70 mt-0.5">
                Top {redditPosts.length} hot
                {redditFetchedAt
                  ? ` · last change ${formatRelative(redditFetchedAt)}`
                  : ''}
              </p>
            </div>
            <div className="text-3xl shrink-0">🗣️</div>
          </div>
        </div>
        <RedditBlock posts={redditPosts} />
      </div>
    </div>
  );
}
