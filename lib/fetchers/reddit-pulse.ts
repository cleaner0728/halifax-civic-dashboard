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
  // Whether a clip exists for the requested language. The actual bytes are
  // streamed lazily by /api/reddit-briefing/audio/<postId>, so we only need a
  // presence flag here — not the (multi-hundred-KB) base64 payload.
  hasAudio: boolean;
  generatedAt: string;
};

export type PulseLang = "en" | "zh";

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
  summary_text_zh: string | null;
  word_count: number | null;
  community_reaction: string | null;
  has_en_audio: boolean;
  has_zh_audio: boolean;
};

export async function fetchRedditPulse(lang: PulseLang = "en"): Promise<RedditPulse | null> {
  let rows: Row[];
  try {
    // Pick the most recent summary_date that has rows, then every row for
    // that day ordered by rank (higher rank = more relevant first). We select
    // audio *presence* (booleans), never the base64 itself — the per-clip
    // route streams the bytes on demand.
    rows = await sql<Row[]>`
      SELECT id, generated_at, summary_date, post_id, title, flair,
             score, num_comments, selection_reason, rank,
             summary_text, summary_text_zh, word_count, community_reaction,
             (tts_audio IS NOT NULL) AS has_en_audio,
             (tts_audio_zh IS NOT NULL) AS has_zh_audio
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
    // Chinese summary falls back to English per-row when not yet generated.
    summary: lang === "zh" ? (r.summary_text_zh ?? r.summary_text) : r.summary_text,
    communityReaction: r.community_reaction,
    selectionReason: r.selection_reason,
    rank: r.rank,
    wordCount: r.word_count,
    hasAudio: lang === "zh" ? r.has_zh_audio : r.has_en_audio,
    generatedAt: r.generated_at,
  }));

  return {
    summaryDate: new Date(rows[0].summary_date).toISOString().slice(0, 10),
    items,
  };
}
