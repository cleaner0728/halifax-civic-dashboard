// Per-post Reddit pulse playlist. Reads reddit_post_summaries (one row per
// post, written by the Mac Mini's Gemini + Google TTS pipeline) and returns
// an ordered playlist. Audio lives inline in the row as base64-encoded M4A
// (column `tts_audio`); we wrap it in a data URL so the player consumes the
// same shape as the legacy news/Reddit briefings.

import { sql } from '@/lib/db';

export type RedditPulseItem = {
  id: number;
  postId: string;
  title: string | null;
  flair: string | null;
  score: number | null;
  numComments: number | null;
  summary: string;
  communityReaction: string | null;
  selectionReason: string | null; // top_score | top_comments
  rank: number | null;
  wordCount: number | null;
  audioDataUrl: string | null; // data:audio/mp4;base64,…  (null when not generated yet)
  generatedAt: string;
};

export type RedditPulse = {
  summaryDate: string; // YYYY-MM-DD
  items: RedditPulseItem[];
};

type Row = {
  id: number;
  generated_at: string;
  summary_date: string;
  post_id: string;
  title: string | null;
  flair: string | null;
  score: number | null;
  num_comments: number | null;
  selection_reason: string | null;
  rank: number | null;
  summary_text: string;
  word_count: number | null;
  community_reaction: string | null;
  tts_audio: string | null;
};

export async function fetchRedditPulse(): Promise<RedditPulse | null> {
  let rows: Row[];
  try {
    // Pick the most recent summary_date that has rows, then every row for
    // that day ordered by rank (higher rank = more relevant first).
    rows = await sql<Row[]>`
      SELECT id, generated_at, summary_date, post_id, title, flair,
             score, num_comments, selection_reason, rank,
             summary_text, word_count, community_reaction, tts_audio
      FROM reddit_post_summaries
      WHERE summary_date = (
        SELECT MAX(summary_date) FROM reddit_post_summaries
      )
      ORDER BY rank DESC NULLS LAST, id ASC
    `;
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === '42P01') {
      console.warn('[reddit-pulse] reddit_post_summaries missing — returning null');
      return null;
    }
    console.error('[reddit-pulse] query failed:', e);
    return null;
  }

  if (rows.length === 0) return null;

  const items: RedditPulseItem[] = rows.map((r) => ({
    id: r.id,
    postId: r.post_id,
    title: r.title,
    flair: r.flair,
    score: r.score,
    numComments: r.num_comments,
    summary: r.summary_text,
    communityReaction: r.community_reaction,
    selectionReason: r.selection_reason,
    rank: r.rank,
    wordCount: r.word_count,
    audioDataUrl: r.tts_audio ? `data:audio/mp4;base64,${r.tts_audio}` : null,
    generatedAt: r.generated_at,
  }));

  return {
    summaryDate: new Date(rows[0].summary_date).toISOString().slice(0, 10),
    items,
  };
}
