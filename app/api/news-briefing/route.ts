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
import { synthesizeSpeech, ZH_VOICE } from '@/lib/ai/tts';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
};

const INTRO_URL = 'briefing-intro://welcome';

function fmtUpdated(d: Date): string {
  // Intl emits "p.m." with a trailing period on en-CA; strip it so the spoken
  // intro doesn't end in a double dot.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(/\.$/, '');
}

function introText(latest: Date): string {
  return `Welcome to your Halifax briefing. These stories were last updated on ${fmtUpdated(latest)}.`;
}

// Chinese intro is static (no timestamp) so it caches forever and stays simple.
const INTRO_ZH = '欢迎收听您的哈利法克斯简报。';

// Per-instance TTS cache, keyed so a warm Lambda re-uses the MP3. The English
// key includes the latest pub_date (the spoken text says "updated as of …");
// the Chinese key is just 'zh' since its text never changes.
const introCache = new Map<string, string | null>();

async function getIntroAudio(latest: Date, zh: boolean): Promise<string | null> {
  const key = zh ? 'zh' : `en:${latest.toISOString()}`;
  const cached = introCache.get(key);
  if (cached !== undefined) return cached;
  const mp3 = await synthesizeSpeech(zh ? INTRO_ZH : introText(latest), zh ? ZH_VOICE : undefined);
  const audioB64 = mp3 ? mp3.toString('base64') : null;
  introCache.set(key, audioB64);
  return audioB64;
}

// The collection is scoped to today's Halifax calendar day (matches fetchNews):
// it accumulates through the day and resets at local midnight. The SQL below
// uses date_trunc on NOW() AT TIME ZONE 'America/Halifax' to get local midnight.

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
  // lang=zh → serve the pre-generated Chinese summary + audio, falling back to
  // English per-row (COALESCE) for any article whose Chinese isn't ready yet.
  // Anything other than 'zh' keeps the original English behavior byte-for-byte.
  const zh = req.nextUrl.searchParams.get('lang') === 'zh';

  const summaryCol = zh ? sql`COALESCE(summary_zh, summary)` : sql`summary`;
  const audioCol = zh ? sql`COALESCE(audio_zh_b64, audio_b64)` : sql`audio_b64`;

  const rows = textOnly
    ? await sql<Row[]>`
        SELECT url, title, source, ${summaryCol} AS summary, pub_date
        FROM article_summary
        WHERE COALESCE(pub_date, created_at) >= date_trunc('day', NOW() AT TIME ZONE 'America/Halifax') AT TIME ZONE 'America/Halifax'
        ORDER BY COALESCE(pub_date, created_at) DESC
      `
    : await sql<Row[]>`
        SELECT url, title, source, ${summaryCol} AS summary, pub_date, ${audioCol} AS audio_b64
        FROM article_summary
        WHERE COALESCE(pub_date, created_at) >= date_trunc('day', NOW() AT TIME ZONE 'America/Halifax') AT TIME ZONE 'America/Halifax'
        ORDER BY COALESCE(pub_date, created_at) DESC
      `;

  const items: Array<Record<string, unknown>> = rows.map((r) => ({
    url: r.url,
    title: r.title,
    source: r.source,
    summary: r.summary,
    pubDate: r.pub_date,
    ...(textOnly
      ? {}
      : { audio: r.audio_b64 ? `data:audio/mp3;base64,${r.audio_b64}` : null }),
  }));

  // Spoken intro: synthesized on demand from the newest pub_date so the voice
  // can say "updated as of …". Prepended as a synthetic playlist item so the
  // player streams it before the first article with no client-side changes.
  let latest: Date | null = null;
  for (const r of rows) {
    if (!r.pub_date) continue;
    const t = new Date(r.pub_date);
    if (isNaN(t.getTime())) continue;
    if (!latest || t > latest) latest = t;
  }
  if (latest) {
    const summary = zh ? INTRO_ZH : introText(latest);
    const audioB64 = textOnly ? null : await getIntroAudio(latest, zh);
    items.unshift({
      url: INTRO_URL,
      title: 'Welcome to your Halifax briefing',
      source: null,
      summary,
      pubDate: null,
      ...(textOnly
        ? {}
        : { audio: audioB64 ? `data:audio/mp3;base64,${audioB64}` : null }),
    });
  }

  return Response.json({ items }, { headers: CACHE_HEADERS });
}
