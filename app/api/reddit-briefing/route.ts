// GET /api/reddit-briefing           → { items: [{slot,label,summary,postCount,createdAt,audio,...}] }
// GET /api/reddit-briefing?mode=text → same, but without the audio field
//
// Returns today's Reddit pulse as a playlist. Primary source is the per-post
// rows in reddit_post_summaries (Mac Mini's Gemini + Google TTS pipeline
// writes one row per post with the m4a audio inline in `tts_audio` as
// base64). Falls back to the legacy reddit_briefing table when the new
// source is empty — keeps the player working on a fresh install.

import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { fetchRedditPulse } from '@/lib/fetchers/reddit-pulse';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
};

type LegacyRow = {
  briefing_date: string;
  slot: 'morning' | 'evening' | 'late_night';
  summary: string;
  audio_b64: string | null;
  post_count: number;
  created_at: string;
};

function halifaxToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function GET(req: NextRequest) {
  const textOnly = req.nextUrl.searchParams.get('mode') === 'text';

  // 1. Primary path — per-post playlist from reddit_post_summaries.
  const pulse = await fetchRedditPulse();
  if (pulse && pulse.items.length > 0) {
    const items = pulse.items.map((it) => ({
      slot: it.postId, // unique identity per playlist position
      label: it.title,
      summary: it.summary,
      postCount: it.numComments ?? 0, // "X comments" in the player ticker
      createdAt: it.generatedAt,
      // Extras the player optionally surfaces.
      postId: it.postId,
      flair: it.flair,
      score: it.score,
      numComments: it.numComments,
      communityReaction: it.communityReaction,
      ...(textOnly ? {} : { audio: it.audioDataUrl }),
    }));
    return Response.json({ items }, { headers: CACHE_HEADERS });
  }

  // 2. Fallback — legacy reddit_briefing rows (single-row-per-slot summaries).
  const today = halifaxToday();
  let rows: LegacyRow[];
  try {
    rows = textOnly
      ? await sql<LegacyRow[]>`
          SELECT briefing_date, slot, summary, NULL::text AS audio_b64, post_count, created_at
          FROM reddit_briefing
          WHERE briefing_date = ${today}
          ORDER BY CASE slot WHEN 'morning' THEN 0 WHEN 'evening' THEN 1 ELSE 2 END
        `
      : await sql<LegacyRow[]>`
          SELECT briefing_date, slot, summary, audio_b64, post_count, created_at
          FROM reddit_briefing
          WHERE briefing_date = ${today}
          ORDER BY CASE slot WHEN 'morning' THEN 0 WHEN 'evening' THEN 1 ELSE 2 END
        `;
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === '42P01') {
      console.warn('[reddit-briefing] legacy table missing — returning empty');
      return Response.json({ items: [] }, { headers: CACHE_HEADERS });
    }
    throw e;
  }

  const items = rows.map((r) => ({
    slot: r.slot,
    summary: r.summary,
    postCount: r.post_count,
    createdAt: r.created_at,
    ...(textOnly
      ? {}
      : { audio: r.audio_b64 ? `data:audio/mp3;base64,${r.audio_b64}` : null }),
  }));

  return Response.json({ items }, { headers: CACHE_HEADERS });
}
