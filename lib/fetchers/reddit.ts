// r/halifax posts. Two sources: the Supabase reddit_posts table (rich fields,
// kept for whenever something writes it again — nothing does today), and
// public/reddit.json, the RSS-style snapshot that
// .github/workflows/fetch-reddit.yml commits daily. The snapshot is currently
// the only live source, so expect the DB-only fields below to be absent.

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

// Recurring mod pins that aren't posted by AutoModerator. Matched on title
// because the RSS path carries no `stickied` flag.
const MOD_PIN_TITLE_PATTERNS = [
  /^Free Food\/Laundry\/Shower Resources in HRM/i,
  /^Things To Do In HRM This Month/i,
];

function isModPin(post: RedditPost): boolean {
  return (
    post.author === 'AutoModerator' ||
    MOD_PIN_TITLE_PATTERNS.some((re) => re.test(post.title))
  );
}

// Try the DB first (richer data, no stickied/mod posts). That path is dormant
// — nothing writes reddit_posts at the moment — so in practice the feed comes
// from the committed JSON snapshot.
export async function fetchRedditPosts(): Promise<RedditFeed> {
  const db = await fetchRedditPostsFromDb();
  if (db && db.posts.length > 0) return { ...db, source: 'db' };

  try {
    const raw = await readFile(resolve('public/reddit.json'), 'utf-8');
    const data = JSON.parse(raw) as { fetchedAt?: string; posts?: RedditPost[] };
    const all = data.posts ?? [];
    const kept = all.filter((p) => !isModPin(p));
    // A pin heuristic must never empty the feed. The previous one also dropped
    // `score === 0 && numComments === 0`, which reads like a dead pin but is
    // what *every* post looks like on the RSS path — the one the daily job
    // always lands on, because Reddit blocks the JSON endpoints from
    // data-center IPs. That silently blanked the whole block; a slightly dirty
    // feed beats no feed.
    const posts = kept.length > 0 ? kept : all;
    return { posts, fetchedAt: data.fetchedAt ?? null, source: 'rss' };
  } catch (e) {
    console.warn('[Reddit] failed to read public/reddit.json:', e);
    return { posts: [], fetchedAt: null, source: 'rss' };
  }
}
