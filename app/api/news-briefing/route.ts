// GET /api/news-briefing           → { items: [{url,title,source,summary,pubDate,audio}] }
// GET /api/news-briefing?mode=text → same, but without the audio field
//
// Returns the collection of per-article summaries from the last 8 hours
// (same window as the Feed), newest first. Each article is summarized once by
// the generate endpoint and stored in article_summary; this route is a pure,
// fast read from Supabase. Audio is included only in the full (non-text) mode
// since the base64 clips are large.

import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
};

const WINDOW_HOURS = 8; // match the Feed

type Row = {
  url: string;
  title: string;
  source: string | null;
  summary: string;
  pub_date: string | null;
  audio_b64?: string | null;
};

export async function GET(req: NextRequest) {
  const textOnly = req.nextUrl.searchParams.get('mode') === 'text';

  const rows = textOnly
    ? await sql<Row[]>`
        SELECT url, title, source, summary, pub_date
        FROM article_summary
        WHERE COALESCE(pub_date, created_at) > NOW() - make_interval(hours => ${WINDOW_HOURS})
        ORDER BY COALESCE(pub_date, created_at) DESC
      `
    : await sql<Row[]>`
        SELECT url, title, source, summary, pub_date, audio_b64
        FROM article_summary
        WHERE COALESCE(pub_date, created_at) > NOW() - make_interval(hours => ${WINDOW_HOURS})
        ORDER BY COALESCE(pub_date, created_at) DESC
      `;

  const items = rows.map((r) => ({
    url: r.url,
    title: r.title,
    source: r.source,
    summary: r.summary,
    pubDate: r.pub_date,
    ...(textOnly
      ? {}
      : { audio: r.audio_b64 ? `data:audio/mp3;base64,${r.audio_b64}` : null }),
  }));

  return Response.json({ items }, { headers: CACHE_HEADERS });
}
