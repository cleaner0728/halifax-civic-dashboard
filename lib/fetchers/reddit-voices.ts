// "Voices" — top-scoring r/halifax comments, surfaced as a citizen-quote
// block on the desktop Pulse view. We take at most one comment per post to
// keep the topic mix diverse (otherwise one viral thread crowds out
// everything else).

import { sql } from '@/lib/db';

export type RedditVoice = {
  id: string;
  body: string;
  score: number;
  author: string;
  isSubmitter: boolean;
  createdUtc: number;
  postId: string;
  postTitle: string;
  postUrl: string;
  postFlair: string | null;
  postFlairBg: string | null;
  postFlairTextColor: 'light' | 'dark' | null;
};

const MIN_SCORE = 10;
const MIN_BODY_LEN = 30;
const LIMIT = 6;

type Row = {
  id: string;
  body: string;
  score: number;
  author: string;
  is_submitter: boolean | null;
  created_utc: string;
  post_id: string;
  post_title: string;
  permalink: string | null;
  link_flair_text: string | null;
  link_flair_background_color: string | null;
  link_flair_text_color: 'light' | 'dark' | null;
};

export async function fetchRedditVoices(): Promise<RedditVoice[]> {
  let rows: Row[];
  try {
    rows = await sql<Row[]>`
      SELECT DISTINCT ON (top.post_id)
        top.id, top.body, top.score, top.author, top.is_submitter,
        top.created_utc,
        p.id AS post_id, p.title AS post_title, p.permalink,
        p.link_flair_text, p.link_flair_background_color, p.link_flair_text_color
      FROM (
        SELECT c.*, ROW_NUMBER() OVER (PARTITION BY c.post_id ORDER BY c.score DESC) AS rn
        FROM reddit_comments c
        WHERE c.depth <= 1
          AND c.score >= ${MIN_SCORE}
          AND c.removed_by_category IS NULL
          AND length(c.body) >= ${MIN_BODY_LEN}
      ) top
      JOIN reddit_posts p ON p.id = top.post_id
      WHERE top.rn = 1
        AND COALESCE(p.stickied, false) = false
        AND COALESCE(p.pinned, false) = false
      ORDER BY top.post_id, top.score DESC
      LIMIT 200
    `;
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === '42P01') {
      console.warn('[reddit-voices] table missing — returning empty');
      return [];
    }
    console.error('[reddit-voices] query failed:', e);
    return [];
  }

  // DISTINCT ON forced ordering by post_id; re-sort by score and trim.
  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, LIMIT)
    .map((r) => ({
      id: r.id,
      body: r.body,
      score: r.score,
      author: r.author,
      isSubmitter: r.is_submitter ?? false,
      createdUtc: Number(r.created_utc),
      postId: r.post_id,
      postTitle: r.post_title,
      postUrl: r.permalink
        ? `https://www.reddit.com${r.permalink}`
        : `https://www.reddit.com/r/halifax/comments/${r.post_id}`,
      postFlair: r.link_flair_text,
      postFlairBg: r.link_flair_background_color,
      postFlairTextColor: r.link_flair_text_color,
    }));
}
