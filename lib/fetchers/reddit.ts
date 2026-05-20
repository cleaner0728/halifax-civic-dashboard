// r/halifax posts. Source of truth is public/reddit.json, refreshed every
// 30 min by .github/workflows/fetch-reddit.yml (GitHub Actions runners can
// still reach Reddit; Vercel's data-center IPs cannot).

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type RedditPost = {
  title: string;
  score: number;
  numComments: number;
  author: string;
  url: string;
  flair?: string | null;
  createdUtc: number;
};

export async function fetchRedditPosts(): Promise<{
  posts: RedditPost[];
  fetchedAt: string | null;
}> {
  try {
    const raw = await readFile(resolve('public/reddit.json'), 'utf-8');
    const data = JSON.parse(raw) as { fetchedAt?: string; posts?: RedditPost[] };
    return { posts: data.posts ?? [], fetchedAt: data.fetchedAt ?? null };
  } catch (e) {
    console.warn('[Reddit] failed to read public/reddit.json:', e);
    return { posts: [], fetchedAt: null };
  }
}
