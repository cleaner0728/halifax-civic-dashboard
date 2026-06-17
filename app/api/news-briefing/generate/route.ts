// POST /api/news-briefing/generate
//
// Incremental, per-article generation. For each story currently in the news
// feed that we haven't already processed (keyed by URL), fetch its full text,
// summarize it, synthesize a short audio clip, and store the row. Articles are
// summarized exactly once and reused forever — new stories add a row, they
// never trigger reprocessing of existing ones.
//
// Called by GitHub Actions on a short interval. Because it's incremental, each
// run typically processes only the 1-2 newest stories, so it stays well under
// any timeout.

import type { NextRequest } from 'next/server';
import { fetchNews } from '@/lib/fetchers/news';
import { summarizeArticle } from '@/lib/ai/summarize';
import { synthesizeSpeech, ZH_VOICE } from '@/lib/ai/tts';
import { translateToChinese } from '@/lib/ai/translate';
import { sql } from '@/lib/db';

export const maxDuration = 60;

// Cap new articles processed per run so a cold start (many fresh rows) can't
// blow the time budget — leftovers are picked up on the next run.
const MAX_NEW_PER_RUN = 8;
const PROCESS_CONCURRENCY = 4;
const RETENTION_HOURS = 48;

// Pre-generate Chinese (translation + TTS) for existing English-only rows, a
// few per run. New articles get Chinese inline (below); this only backfills
// rows that predate the Chinese columns. Kept small so it shares the 60s
// budget with the English path.
const MAX_ZH_BACKFILL_PER_RUN = 6;

// Best-effort Chinese summary + audio for one English summary. Any failure
// returns nulls — it must never block or break the English path. Translation
// and TTS are independent: a translation with failed audio still caches the
// text so the next run can retry just the audio.
async function makeChinese(
  enSummary: string,
): Promise<{ zhText: string | null; zhAudio: string | null }> {
  const zhText = await translateToChinese(enSummary);
  if (!zhText) return { zhText: null, zhAudio: null };
  const mp3 = await synthesizeSpeech(zhText, ZH_VOICE);
  return { zhText, zhAudio: mp3 ? mp3.toString('base64') : null };
}

// Fill Chinese for older rows missing either the text or the audio so a
// transient failure self-heals on a later run. Runs on every invocation —
// including the common "no new articles" path — so the backlog drains over
// time. Returns how many rows were updated.
async function backfillChinese(): Promise<number> {
  const pending = await sql<{ url: string; summary: string }[]>`
    SELECT url, summary FROM article_summary
    WHERE summary IS NOT NULL
      AND (summary_zh IS NULL OR audio_zh_b64 IS NULL)
    ORDER BY COALESCE(pub_date, created_at) DESC
    LIMIT ${MAX_ZH_BACKFILL_PER_RUN}
  `;
  let n = 0;
  const one = async (row: { url: string; summary: string }) => {
    const { zhText, zhAudio } = await makeChinese(row.summary);
    if (!zhText) return;
    await sql`
      UPDATE article_summary
      SET summary_zh = ${zhText}, audio_zh_b64 = ${zhAudio}
      WHERE url = ${row.url}
    `;
    n++;
  };
  for (let i = 0; i < pending.length; i += PROCESS_CONCURRENCY) {
    await Promise.all(pending.slice(i, i + PROCESS_CONCURRENCY).map(one));
  }
  return n;
}

function toDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Keep the table bounded — drop rows older than the retention window.
async function pruneOld() {
  await sql`DELETE FROM article_summary WHERE pub_date < NOW() - make_interval(hours => ${RETENTION_HOURS})`;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const t0 = Date.now();
  const { items } = await fetchNews();
  if (items.length === 0) {
    return Response.json({ skipped: true, reason: 'no_items' });
  }

  // Which URLs have we already summarized?
  const urls = items.map((i) => i.link).filter((u): u is string => !!u);
  const existing = urls.length
    ? await sql<{ url: string }[]>`SELECT url FROM article_summary WHERE url IN ${sql(urls)}`
    : [];
  const seen = new Set(existing.map((r) => r.url));

  const fresh = items
    .filter((i) => i.link && !seen.has(i.link))
    .slice(0, MAX_NEW_PER_RUN);

  if (fresh.length === 0) {
    // No new English articles — but still drain the Chinese backlog.
    const zhBackfilled = await backfillChinese();
    await pruneOld();
    console.log(`[gen] no new articles — zh backfilled ${zhBackfilled}`);
    return Response.json({ ok: true, added: 0, zhBackfilled, reason: 'all_current' });
  }

  console.log(`[gen] ${fresh.length} new article(s) to process`);

  // Rephrase + synthesize + insert, in small parallel batches.
  let added = 0;
  const processOne = async (item: (typeof fresh)[number]) => {
    const summary = await summarizeArticle(item);
    if (!summary) return;
    const mp3 = await synthesizeSpeech(summary);
    const audio = mp3 ? mp3.toString('base64') : null;
    // Chinese is best-effort and additive — never gates the English insert.
    const { zhText, zhAudio } = await makeChinese(summary);
    await sql`
      INSERT INTO article_summary (url, title, source, summary, audio_b64, summary_zh, audio_zh_b64, pub_date)
      VALUES (${item.link!}, ${item.title ?? ''}, ${item.source ?? null},
              ${summary}, ${audio}, ${zhText}, ${zhAudio}, ${toDate(item.pubDate)})
      ON CONFLICT (url) DO NOTHING
    `;
    added++;
    console.log(`[gen] + ${(item.title ?? '').slice(0, 60)}${zhText ? ' (zh ✓)' : ''}`);
  };

  for (let i = 0; i < fresh.length; i += PROCESS_CONCURRENCY) {
    await Promise.all(fresh.slice(i, i + PROCESS_CONCURRENCY).map(processOne));
  }

  // Drain a few older rows still missing Chinese (shares the 60s budget).
  const zhBackfilled = await backfillChinese();

  await pruneOld();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[gen] done in ${elapsed}s — added ${added}, zh backfilled ${zhBackfilled}`);
  return Response.json({ ok: true, added, zhBackfilled, elapsedSec: parseFloat(elapsed) });
}
