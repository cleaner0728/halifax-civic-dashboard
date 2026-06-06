// Pulls r/halifax posts from the Supabase reddit_posts table. The Mac Mini
// scraper writes rows every ~30 min; we treat data as fresh if the newest
// last_fetched_at is within MAX_AGE_HOURS. Stickied / mod-pinned posts are
// filtered out at the SQL layer — they aren't civic discussion content.

import { sql } from '@/lib/db';
import type { RedditPost } from './reddit';

const MAX_AGE_HOURS = 4;
const LIMIT = 30;

type Row = {
  id: string;
  title: string;
  selftext: string | null;
  url: string | null;
  permalink: string | null;
  domain: string | null;
  post_hint: string | null;
  is_self: boolean | null;
  is_video: boolean | null;
  thumbnail: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  author: string;
  author_flair_text: string | null;
  score: number;
  upvote_ratio: number | null;
  num_comments: number;
  link_flair_text: string | null;
  link_flair_background_color: string | null;
  link_flair_text_color: 'light' | 'dark' | null;
  over_18: boolean | null;
  spoiler: boolean | null;
  distinguished: string | null;
  gilded: number | null;
  total_awards_received: number | null;
  created_utc: string; // bigint comes back as string
  last_fetched_at: string;
};

export async function fetchRedditPostsFromDb(): Promise<{
  posts: RedditPost[];
  fetchedAt: string | null;
} | null> {
  let rows: Row[];
  try {
    rows = await sql<Row[]>`
      SELECT
        id, title, selftext, url, permalink, domain, post_hint,
        is_self, is_video, thumbnail, thumbnail_width, thumbnail_height,
        author, author_flair_text,
        score, upvote_ratio, num_comments,
        link_flair_text, link_flair_background_color, link_flair_text_color,
        over_18, spoiler, distinguished, gilded, total_awards_received,
        created_utc, last_fetched_at
      FROM reddit_posts
      WHERE COALESCE(stickied, false) = false
        AND COALESCE(pinned, false) = false
        AND last_fetched_at > now() - (${MAX_AGE_HOURS}::text || ' hours')::interval
      ORDER BY score DESC NULLS LAST, created_utc DESC
      LIMIT ${LIMIT}
    `;
  } catch (e: unknown) {
    // Missing table in fresh envs (SQLSTATE 42P01) → fall back gracefully.
    const code = (e as { code?: string } | null)?.code;
    if (code === '42P01') {
      console.warn('[reddit-db] reddit_posts table missing — falling back to RSS');
      return null;
    }
    console.error('[reddit-db] query failed:', e);
    return null;
  }

  if (rows.length === 0) return null;

  const posts: RedditPost[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    score: r.score ?? 0,
    numComments: r.num_comments ?? 0,
    author: r.author,
    url: r.permalink
      ? `https://www.reddit.com${r.permalink}`
      : (r.url ?? `https://www.reddit.com/r/halifax/comments/${r.id}`),
    permalink: r.permalink ?? undefined,
    flair: r.link_flair_text,
    createdUtc: Number(r.created_utc),
    selftext: r.selftext,
    thumbnail:
      r.thumbnail && r.thumbnail.startsWith('http') ? r.thumbnail : null,
    thumbnailWidth: r.thumbnail_width,
    thumbnailHeight: r.thumbnail_height,
    domain: r.domain,
    postHint: r.post_hint,
    isSelf: r.is_self ?? false,
    isVideo: r.is_video ?? false,
    upvoteRatio: r.upvote_ratio,
    authorFlairText: r.author_flair_text,
    linkFlairBackgroundColor: r.link_flair_background_color,
    linkFlairTextColor: r.link_flair_text_color,
    overEighteen: r.over_18 ?? false,
    spoiler: r.spoiler ?? false,
    distinguished: r.distinguished,
    gilded: r.gilded ?? 0,
    totalAwardsReceived: r.total_awards_received ?? 0,
  }));

  const newest = rows.reduce((acc, r) => {
    const t = new Date(r.last_fetched_at).getTime();
    return t > acc ? t : acc;
  }, 0);

  return {
    posts,
    fetchedAt: newest > 0 ? new Date(newest).toISOString() : null,
  };
}
