import NewsBlock from '@/components/blocks/NewsBlock';
import RedditBlock from '@/components/blocks/RedditBlock';
import NewsBriefingPlayer from '@/components/NewsBriefingPlayer';
import RedditBriefingPlayer from '@/components/RedditBriefingPlayer';
import FeedTabs from '@/components/FeedTabs';
import { formatRelative } from '@/lib/date';
import type { NewsItem } from '@/lib/fetchers/news';
import type { RedditPost } from '@/lib/fetchers/reddit';

type Props = {
  news: NewsItem[];
  redditPosts: RedditPost[];
  redditFetchedAt: string | null;
};

export default function FeedScreen({ news, redditPosts, redditFetchedAt }: Props) {
  // News / Reddit are now switched via the segmented toggle (FeedTabs) instead
  // of being stacked. Each section keeps a compact meta line, its briefing
  // player, and its list. The blocks stay server components — they're rendered
  // here and handed to the client FeedTabs as already-rendered nodes.
  const newsSection = (
    <>
      <p className="text-sm text-foreground/50 px-1 mb-3">
        {news.length} {news.length === 1 ? 'story' : 'stories'} · today
      </p>
      {news.length > 0 && <NewsBriefingPlayer />}
      <NewsBlock items={news} />
    </>
  );

  const redditSection = (
    <>
      <p className="text-sm text-foreground/50 px-1 mb-3">
        Top {redditPosts.length} hot
        {redditFetchedAt ? ` · last change ${formatRelative(redditFetchedAt)}` : ''}
      </p>
      {redditPosts.length > 0 && <RedditBriefingPlayer />}
      <RedditBlock posts={redditPosts} />
    </>
  );

  return (
    <div className="pt-14 md:pt-24 pb-24 min-h-dvh">
      {/* Full-width (no max-w cap) so the tabs + card fill the viewport up to
          the 1280px desktop breakpoint; px-3 keeps a little edge breathing room.
          Tabs and card share this width, so they stay equal. */}
      <div className="px-3 mt-2">
        <FeedTabs news={newsSection} reddit={redditSection} />
      </div>
    </div>
  );
}
