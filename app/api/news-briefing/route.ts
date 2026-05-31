import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { fetchNews } from '@/lib/fetchers/news';
import { enrichWithArticleText } from '@/lib/ai/fetch-article';
import { summarizeNews } from '@/lib/ai/summarize';
import { synthesizeSpeech } from '@/lib/ai/tts';

// AI audio briefing for the News feed.
//   GET /api/news-briefing           → { hash, text, audio }  (full briefing)
//   GET /api/news-briefing?mode=text → { hash, text }         (text only, no TTS)
//
// hash is derived from current headlines. Summary + audio regenerate only when
// news changes. Module-level caches + Cache-Control headers minimise API calls.

type Briefing = { hash: string; text: string; audio: string | null };

let cachedFull: Briefing | null = null;   // text + audio
let cachedText: { hash: string; text: string } | null = null; // text only

function hashHeadlines(titles: string[]): string {
  return createHash('sha1').update(titles.join('|')).digest('hex').slice(0, 12);
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
};

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode'); // 'text' | null
  const textOnly = mode === 'text';

  const { items } = await fetchNews();
  if (items.length === 0) {
    return Response.json({ hash: 'empty', text: '' });
  }

  const hash = hashHeadlines(items.map((i) => i.title ?? ''));

  // ── Text-only path ────────────────────────────────────────────────────────
  if (textOnly) {
    // If we already generated the full briefing for this hash, reuse its text.
    if (cachedFull?.hash === hash) {
      return Response.json({ hash, text: cachedFull.text }, { headers: CACHE_HEADERS });
    }
    if (cachedText?.hash === hash) {
      return Response.json(cachedText, { headers: CACHE_HEADERS });
    }
    // Fetch article bodies + summarize (no TTS).
    const enriched = await enrichWithArticleText(items.slice(0, 8));
    const text = await summarizeNews(enriched);
    if (!text) return Response.json({ error: 'briefing_unavailable' }, { status: 503 });
    cachedText = { hash, text };
    return Response.json(cachedText, { headers: CACHE_HEADERS });
  }

  // ── Full briefing path (text + audio) ─────────────────────────────────────
  if (cachedFull?.hash === hash) {
    return Response.json(cachedFull, { headers: CACHE_HEADERS });
  }

  // Fetch full article bodies to give Gemini richer context.
  const enriched = await enrichWithArticleText(items.slice(0, 8));
  const text = cachedText?.hash === hash
    ? cachedText.text          // reuse text if we already generated it
    : await summarizeNews(enriched);

  if (!text) return Response.json({ error: 'briefing_unavailable' }, { status: 503 });

  const mp3 = await synthesizeSpeech(text);
  const audio = mp3 ? `data:audio/mp3;base64,${mp3.toString('base64')}` : null;

  if (!audio) return Response.json({ error: 'tts_unavailable' }, { status: 503 });

  cachedFull = { hash, text, audio };
  cachedText = { hash, text }; // keep text cache in sync
  return Response.json(cachedFull, { headers: CACHE_HEADERS });
}
