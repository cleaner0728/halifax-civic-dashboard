// POST /api/news-briefing/generate
//
// Called by Vercel Cron every 30 minutes. Fetches full article text for ALL
// current news items, summarises with Gemini, synthesises Chirp 3 HD audio,
// then upserts the result into Supabase so the read route can serve it
// instantly to users.
//
// Security: Vercel Cron passes `Authorization: Bearer <CRON_SECRET>`.
// Set CRON_SECRET in Vercel env vars (any random string, e.g. openssl rand -hex 32).
// Local dev: POST with the header manually, or omit CRON_SECRET to skip auth.

import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { fetchNews } from '@/lib/fetchers/news';
import { enrichWithArticleText } from '@/lib/ai/fetch-article';
import { summarizeNews } from '@/lib/ai/summarize';
import { synthesizeSpeech } from '@/lib/ai/tts';
import { sql } from '@/lib/db';

// Allow up to 60s — Jina Reader fallback can take 10-20s per JS-rendered site.
// (Vercel Hobby caps at 60s; Pro allows up to 300s.)
export const maxDuration = 60;

// Relaxed limits for background generation — users aren't waiting.
const CRON_CONFIG = {
  maxArticles:       25,    // cover all available articles (rarely this many)
  timeoutMs:         15_000,
  maxParagraphs:     25,
  maxChars:          3_500, // ~875 tokens of body text per article
  concurrency:       5,
};

const SUMMARIZE_CONFIG = {
  maxArticles:        25,
  maxCharsPerArticle: 3_500,
  // ~3-minute briefing. Range is wide so Gemini can scale to the day's volume:
  // a slow news day stays ~320 words, a busy one stretches toward 450.
  wordRange:          '320-450',
  duration:           'roughly 2.5 to 3 minutes',
};

function hashHeadlines(titles: string[]): string {
  return createHash('sha1').update(titles.join('|')).digest('hex').slice(0, 12);
}

export async function POST(req: NextRequest) {
  // Auth check — skip if CRON_SECRET not configured (local dev convenience).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const t0 = Date.now();
  console.log('[cron] briefing generation started');

  // ── 1. Fetch current news ──────────────────────────────────────────────────
  const { items } = await fetchNews();
  if (items.length === 0) {
    console.log('[cron] no news items, skipping');
    return Response.json({ skipped: true, reason: 'no_items' });
  }

  const hash = hashHeadlines(items.map((i) => i.title ?? ''));

  // ── 2. Check if we already have this hash in DB ────────────────────────────
  const force = req.nextUrl.searchParams.get('force') === '1';
  if (!force) {
    const existing = await sql`
      SELECT hash FROM briefing WHERE hash = ${hash} LIMIT 1
    `;
    if (existing.length > 0) {
      console.log(`[cron] hash ${hash} already in DB, skipping`);
      return Response.json({ skipped: true, reason: 'already_current', hash });
    }
  }

  // ── 3. Fetch full article text ─────────────────────────────────────────────
  console.log(`[cron] fetching article text for ${Math.min(items.length, CRON_CONFIG.maxArticles)} articles`);
  const enriched = await enrichWithArticleText(items, CRON_CONFIG);
  const fullCount = enriched.filter((i) => i.articleText).length;
  console.log(`[cron] got full text for ${fullCount}/${enriched.length} articles`);

  // ── 4. Summarise ───────────────────────────────────────────────────────────
  const text = await summarizeNews(enriched, SUMMARIZE_CONFIG);
  if (!text) {
    console.error('[cron] summarization failed');
    return Response.json({ error: 'summarization_failed' }, { status: 500 });
  }
  console.log(`[cron] summary: ${text.split(/\s+/).length} words`);

  // ── 5. TTS ─────────────────────────────────────────────────────────────────
  const mp3 = await synthesizeSpeech(text);
  if (!mp3) {
    console.error('[cron] TTS failed');
    return Response.json({ error: 'tts_failed' }, { status: 500 });
  }
  const audiob64 = mp3.toString('base64');
  console.log(`[cron] audio: ${Math.round(audiob64.length * 0.75 / 1024)} KB`);

  // ── 6. Upsert into Supabase ────────────────────────────────────────────────
  await sql`
    INSERT INTO briefing (hash, text, audio_b64)
    VALUES (${hash}, ${text}, ${audiob64})
    ON CONFLICT (hash) DO UPDATE
      SET text      = EXCLUDED.text,
          audio_b64 = EXCLUDED.audio_b64,
          created_at = NOW()
  `;

  // Keep only the 10 most recent rows to avoid unbounded growth.
  await sql`
    DELETE FROM briefing
    WHERE id NOT IN (
      SELECT id FROM briefing ORDER BY created_at DESC LIMIT 10
    )
  `;

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[cron] done in ${elapsed}s — hash ${hash}`);

  return Response.json({
    ok: true,
    hash,
    wordCount: text.split(/\s+/).length,
    audioKb: Math.round(audiob64.length * 0.75 / 1024),
    elapsedSec: parseFloat(elapsed),
    fullArticles: fullCount,
  });
}
