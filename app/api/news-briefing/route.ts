// GET /api/news-briefing           → { hash, text, audio }  (full briefing)
// GET /api/news-briefing?mode=text → { hash, text }         (text only, no audio)
//
// Reads the latest pre-generated briefing from Supabase. The Cron job at
// /api/news-briefing/generate runs every 30 minutes to keep it fresh.
//
// Falls back to on-demand generation if the DB is empty (e.g. first deploy
// before the cron has run). This ensures the feature works immediately.

import type { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { fetchNews } from '@/lib/fetchers/news';
import { enrichWithArticleText } from '@/lib/ai/fetch-article';
import { summarizeNews } from '@/lib/ai/summarize';
import { synthesizeSpeech } from '@/lib/ai/tts';
import { createHash } from 'node:crypto';

const CACHE_HEADERS = {
  // CDN: serve fresh for 5 min, then stale while revalidating for up to 1 hr.
  // Stale-while-revalidate means users always get an instant response.
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
};

function hashHeadlines(titles: string[]): string {
  return createHash('sha1').update(titles.join('|')).digest('hex').slice(0, 12);
}

export async function GET(req: NextRequest) {
  const textOnly = req.nextUrl.searchParams.get('mode') === 'text';

  // ── Read from Supabase ────────────────────────────────────────────────────
  const rows = await sql<{ hash: string; text: string; audio_b64: string }[]>`
    SELECT hash, text, audio_b64
    FROM briefing
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length > 0) {
    const row = rows[0];
    if (textOnly) {
      return Response.json({ hash: row.hash, text: row.text }, { headers: CACHE_HEADERS });
    }
    return Response.json(
      {
        hash: row.hash,
        text: row.text,
        audio: `data:audio/mp3;base64,${row.audio_b64}`,
      },
      { headers: CACHE_HEADERS },
    );
  }

  // ── Cold start fallback: DB empty, generate on-demand ────────────────────
  // This only happens before the first cron run. After that the DB always
  // has at least one row.
  console.log('[briefing] DB empty — generating on-demand (cold start)');

  // 8h window — same as the Feed and the cron generator, so hashes line up.
  const { items } = await fetchNews();
  if (items.length === 0) {
    return Response.json({ error: 'briefing_unavailable' }, { status: 503 });
  }

  const hash = hashHeadlines(items.map((i) => i.title ?? ''));
  const enriched = await enrichWithArticleText(items);
  const text = await summarizeNews(enriched);
  if (!text) return Response.json({ error: 'briefing_unavailable' }, { status: 503 });

  if (textOnly) return Response.json({ hash, text });

  const mp3 = await synthesizeSpeech(text);
  if (!mp3) return Response.json({ error: 'tts_unavailable' }, { status: 503 });

  const audio = `data:audio/mp3;base64,${mp3.toString('base64')}`;

  // Persist the cold-start result so subsequent requests are instant.
  try {
    await sql`
      INSERT INTO briefing (hash, text, audio_b64)
      VALUES (${hash}, ${text}, ${mp3.toString('base64')})
      ON CONFLICT (hash) DO NOTHING
    `;
  } catch (e) {
    console.warn('[briefing] failed to persist cold-start result', e);
  }

  return Response.json({ hash, text, audio });
}
