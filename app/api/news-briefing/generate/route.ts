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
import { enrichWithArticleText } from '@/lib/ai/fetch-article';
import { summarizeArticle } from '@/lib/ai/summarize';
import { synthesizeSpeech } from '@/lib/ai/tts';
import { sql } from '@/lib/db';

export const maxDuration = 60;

// Cap new articles processed per run so a cold start (many fresh rows) can't
// blow the time budget — leftovers are picked up on the next run.
const MAX_NEW_PER_RUN = 8;
const PROCESS_CONCURRENCY = 4;
const RETENTION_HOURS = 48;

function toDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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
    await sql`DELETE FROM article_summary WHERE pub_date < NOW() - make_interval(hours => ${RETENTION_HOURS})`;
    console.log('[gen] no new articles');
    return Response.json({ ok: true, added: 0, reason: 'all_current' });
  }

  console.log(`[gen] ${fresh.length} new article(s) to process`);

  // Fetch full text for the fresh articles (3-tier scraper, parallel internally).
  const enriched = await enrichWithArticleText(fresh, {
    maxArticles: fresh.length,
    timeoutMs: 15_000,
    maxParagraphs: 25,
    maxChars: 3_500,
    concurrency: 8,
  });

  // Summarize + synthesize + insert, in small parallel batches.
  let added = 0;
  const processOne = async (item: (typeof enriched)[number]) => {
    const summary = await summarizeArticle(item);
    if (!summary) return;
    const mp3 = await synthesizeSpeech(summary);
    const audio = mp3 ? mp3.toString('base64') : null;
    await sql`
      INSERT INTO article_summary (url, title, source, summary, audio_b64, pub_date)
      VALUES (${item.link!}, ${item.title ?? ''}, ${item.source ?? null},
              ${summary}, ${audio}, ${toDate(item.pubDate)})
      ON CONFLICT (url) DO NOTHING
    `;
    added++;
    console.log(`[gen] + ${(item.title ?? '').slice(0, 60)}`);
  };

  for (let i = 0; i < enriched.length; i += PROCESS_CONCURRENCY) {
    await Promise.all(enriched.slice(i, i + PROCESS_CONCURRENCY).map(processOne));
  }

  // Prune old rows so the table doesn't grow unbounded.
  await sql`DELETE FROM article_summary WHERE pub_date < NOW() - (${RETENTION_HOURS} || ' hours')::interval`;

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[gen] done in ${elapsed}s — added ${added}`);
  return Response.json({ ok: true, added, elapsedSec: parseFloat(elapsed) });
}
