import { createHash } from 'node:crypto';
import { fetchNews } from '@/lib/fetchers/news';
import { summarizeNews } from '@/lib/ai/summarize';
import { synthesizeSpeech } from '@/lib/ai/tts';

// AI audio briefing for the News feed.
//   GET /api/news-briefing  ->  { hash, text, audio }
//
// `hash` is derived from the current news headlines. The summary + audio are
// regenerated ONLY when that hash changes — i.e. when the news itself updates.
// A module-level cache means repeated requests for the same news cost zero
// LLM/TTS calls within a warm serverless instance; the Cache-Control header
// adds a CDN layer on top so even cold starts are mostly served from the edge.

type Briefing = { hash: string; text: string; audio: string | null };

let cached: Briefing | null = null;

function hashHeadlines(titles: string[]): string {
  return createHash('sha1').update(titles.join('|')).digest('hex').slice(0, 12);
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
};

export async function GET() {
  const { items } = await fetchNews();
  if (items.length === 0) {
    return Response.json({ hash: 'empty', text: '', audio: null } satisfies Briefing);
  }

  const hash = hashHeadlines(items.map((i) => i.title ?? ''));

  // News unchanged since last generation → serve cached, no API calls.
  if (cached && cached.hash === hash && cached.audio) {
    return Response.json(cached, { headers: CACHE_HEADERS });
  }

  const text = await summarizeNews(items);
  if (!text) {
    // Key missing or LLM failed — signal "unavailable" so the client hides
    // the player rather than showing a broken control.
    return Response.json({ error: 'briefing_unavailable' }, { status: 503 });
  }

  const mp3 = await synthesizeSpeech(text);
  // Inline the audio as a data URI: avoids needing blob storage and keeps the
  // summary text + audio atomically in sync (same hash, one response).
  // Chirp 3 HD returns ready-to-play MP3.
  const audio = mp3 ? `data:audio/mp3;base64,${mp3.toString('base64')}` : null;

  if (!audio) {
    return Response.json({ error: 'tts_unavailable' }, { status: 503 });
  }

  cached = { hash, text, audio };
  return Response.json(cached, { headers: CACHE_HEADERS });
}
