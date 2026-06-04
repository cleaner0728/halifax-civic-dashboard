// GET /api/reddit-briefing           → { items: [{slot,summary,createdAt,postCount,audio}] }
// GET /api/reddit-briefing?mode=text → same, but without the audio field
//
// Returns today's Reddit rollups (max 2 — morning + evening), ordered
// chronologically so the player plays morning first. Written by the
// /api/reddit-briefing/generate endpoint on a twice-daily cron.

import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
};

type Row = {
  briefing_date: string;
  slot: 'morning' | 'evening' | 'late_night';
  summary: string;
  audio_b64: string | null;
  post_count: number;
  created_at: string;
};

// Halifax local date string (YYYY-MM-DD) for the SELECT filter.
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
  const today = halifaxToday();

  // The table is created out-of-band in Supabase; in a fresh environment it
  // may not exist yet. Treat "missing table" (Postgres SQLSTATE 42P01) as
  // an empty result so the player can render its "no pulse yet" state
  // rather than blowing up the page. Other errors still propagate.
  let rows: Row[];
  try {
    rows = textOnly
      ? await sql<Row[]>`
          SELECT briefing_date, slot, summary, NULL::text AS audio_b64, post_count, created_at
          FROM reddit_briefing
          WHERE briefing_date = ${today}
          ORDER BY CASE slot WHEN 'morning' THEN 0 WHEN 'evening' THEN 1 ELSE 2 END
        `
      : await sql<Row[]>`
          SELECT briefing_date, slot, summary, audio_b64, post_count, created_at
          FROM reddit_briefing
          WHERE briefing_date = ${today}
          ORDER BY CASE slot WHEN 'morning' THEN 0 WHEN 'evening' THEN 1 ELSE 2 END
        `;
  } catch (e: unknown) {
    const code = (e as { code?: string } | null)?.code;
    if (code === '42P01') {
      console.warn('[reddit-briefing] table missing — returning empty');
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
