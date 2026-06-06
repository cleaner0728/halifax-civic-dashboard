// r/halifax posts. Two sources: Supabase reddit_posts table (primary, written by
// the Mac Mini scraper — rich fields), and public/reddit.json (RSS-style
// fallback, refreshed every 30 min by .github/workflows/fetch-reddit.yml when
// the Mac Mini is offline).

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchRedditPostsFromDb } from './reddit-db';

export type RedditPost = {
  // Always populated (both DB and RSS paths)
  title: string;
  score: number;
  numComments: number;
  author: string;
  url: string;
  flair?: string | null;
  createdUtc: number;

  // DB-only enrichment — undefined when sourced from RSS fallback. UI must
  // treat each as optional so the mobile RedditBlock keeps rendering as-is
  // even when these are present.
  id?: string;
  permalink?: string;
  selftext?: string | null;
  thumbnail?: string | null;
  thumbnailWidth?: number | null;
  thumbnailHeight?: number | null;
  domain?: string | null;
  postHint?: string | null;
  isSelf?: boolean;
  isVideo?: boolean;
  upvoteRatio?: number | null;
  authorFlairText?: string | null;
  linkFlairBackgroundColor?: string | null;
  linkFlairTextColor?: 'light' | 'dark' | null;
  overEighteen?: boolean;
  spoiler?: boolean;
  distinguished?: string | null;
  totalAwardsReceived?: number;
  gilded?: number;
};

export type RedditFeed = {
  posts: RedditPost[];
  fetchedAt: string | null;
  source: 'db' | 'rss';
};

// Try the DB first (richer data, no stickied/mod posts). If it's empty or
// stale, fall back to the JSON snapshot — which the existing GitHub Actions
// job keeps fresh as a safety net.
export async function fetchRedditPosts(): Promise<RedditFeed> {
  const db = await fetchRedditPostsFromDb();
  if (db && db.posts.length > 0) return { ...db, source: 'db' };

  try {
    const raw = await readFile(resolve('public/reddit.json'), 'utf-8');
    const data = JSON.parse(raw) as { fetchedAt?: string; posts?: RedditPost[] };
    // Light stickied heuristic for the RSS path, which has no `stickied`
    // flag: AutoModerator monthly posts and obvious mod resource pins.
    const posts = (data.posts ?? []).filter(
      (p) => p.author !== 'AutoModerator' && !(p.score === 0 && p.numComments === 0),
    );
    return { posts, fetchedAt: data.fetchedAt ?? null, source: 'rss' };
  } catch (e) {
    console.warn('[Reddit] failed to read public/reddit.json:', e);
    return { posts: [], fetchedAt: null, source: 'rss' };
  }
}
