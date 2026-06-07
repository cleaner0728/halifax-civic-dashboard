// POST /api/civic-feeds/refresh
//
// Runs the four City Live scrapers (ferry / transit / incidents / hrm_news)
// and upserts the current items into the generic `civic_updates` table. The
// upsert preserves `first_seen_at` (which drives the "updated today" dot) and
// bumps `last_seen_at` every run, so the read path can treat an item as
// "currently active" while it keeps being re-confirmed. Resolved disruptions
// simply stop being upserted and age out of the read window.
//
// Called by .github/workflows/fetch-civic-feeds.yml on a short interval, the
// same GitHub-Actions-as-cron pattern as the news briefing generator. Auth is
// the shared CRON_SECRET bearer token (only enforced when CRON_SECRET is set).

import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { sql } from '@/lib/db';
import {
  fetchFerryAlerts,
  fetchTransitDetours,
  fetchTransitAdjustments,
} from '@/lib/fetchers/transit';
import { fetchHrfeIncidents, fetchHrmNews } from '@/lib/fetchers/hrm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Drop rows nothing has re-confirmed in a week so the table stays bounded.
const RETENTION_DAYS = 7;

type Item = {
  id: string;
  feed: 'ferry' | 'transit' | 'incidents' | 'hrm_news';
  title: string;
  body: string | null;
  url: string | null;
  publishedAt: Date | null;
  payload: Record<string, unknown> | null;
};

function hash(...parts: string[]): string {
  return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

function toDate(s: string | undefined | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Run every scraper, normalize into flat civic_updates rows. Each scraper is
// independently guarded — one upstream failing shouldn't sink the whole run.
async function collect(): Promise<Item[]> {
  const [ferry, detours, adjustment, incidents, hrm] = await Promise.all([
    fetchFerryAlerts().catch((e) => (console.error('[civic] ferry:', e), [])),
    fetchTransitDetours().catch((e) => (console.error('[civic] detours:', e), [])),
    fetchTransitAdjustments().catch((e) => (console.error('[civic] adjustments:', e), null)),
    fetchHrfeIncidents().catch((e) => (console.error('[civic] incidents:', e), [])),
    fetchHrmNews().catch((e) => (console.error('[civic] hrm-news:', e), { items: [], dateLabel: '' })),
  ]);

  const items: Item[] = [];

  for (const f of ferry) {
    items.push({
      id: `ferry:${hash(f.title)}`,
      feed: 'ferry',
      title: f.title,
      body: f.body || null,
      url: f.moreDetailsUrl ?? null,
      publishedAt: null,
      payload: null,
    });
  }

  for (const d of detours) {
    items.push({
      id: `transit:detour:${hash(d.title)}`,
      feed: 'transit',
      title: d.title,
      body: d.summary ?? null,
      url: null,
      publishedAt: null,
      payload: {
        kind: 'detour',
        routes: d.routes ?? '',
        date: d.date ?? null,
        startDate: d.startDate ?? null,
        endDate: d.endDate ?? null,
        time: d.time ?? null,
        location: d.location ?? null,
      },
    });
  }

  if (adjustment) {
    items.push({
      id: `transit:adjustment:${hash(adjustment.dateLabel)}`,
      feed: 'transit',
      title: `${adjustment.dateLabel} Service Changes`,
      body: adjustment.intro ?? null,
      url: adjustment.sourceUrl ?? null,
      publishedAt: null,
      payload: {
        kind: 'adjustment',
        dateLabel: adjustment.dateLabel,
        bullets: adjustment.bullets ?? [],
      },
    });
  }

  for (const i of incidents) {
    const link = i.link ?? '';
    items.push({
      id: `incidents:${link ? hash(link) : hash(i.title ?? '', i.pubDate ?? '')}`,
      feed: 'incidents',
      title: i.title ?? '(untitled)',
      body: i.description ?? null,
      url: i.link ?? null,
      publishedAt: toDate(i.pubDate),
      payload: null,
    });
  }

  for (const n of hrm.items) {
    const link = n.link ?? '';
    items.push({
      id: `hrm_news:${link ? hash(link) : hash(n.title ?? '', n.pubDate ?? '')}`,
      feed: 'hrm_news',
      title: n.title ?? '(untitled)',
      body: n.description ?? null,
      url: n.link ?? null,
      publishedAt: toDate(n.pubDate),
      payload: null,
    });
  }

  return items;
}

async function upsert(item: Item): Promise<void> {
  await sql`
    INSERT INTO civic_updates
      (id, feed, title, body, url, published_at, payload, first_seen_at, last_seen_at, updated_at)
    VALUES (
      ${item.id}, ${item.feed}, ${item.title}, ${item.body}, ${item.url},
      ${item.publishedAt}, ${item.payload ? sql.json(item.payload as Parameters<typeof sql.json>[0]) : null},
      now(), now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET
      title        = EXCLUDED.title,
      body         = EXCLUDED.body,
      url          = EXCLUDED.url,
      published_at = EXCLUDED.published_at,
      payload      = EXCLUDED.payload,
      last_seen_at = now(),
      updated_at   = now()
  `;
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
  const items = await collect();

  // Upsert in small parallel batches — the volume is tiny (tens of rows).
  const CONCURRENCY = 6;
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    await Promise.all(items.slice(i, i + CONCURRENCY).map(upsert));
  }

  await sql`DELETE FROM civic_updates WHERE last_seen_at < now() - make_interval(days => ${RETENTION_DAYS})`;

  const counts = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.feed] = (acc[it.feed] ?? 0) + 1;
    return acc;
  }, {});

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[civic] upserted ${items.length} in ${elapsed}s`, counts);
  return Response.json({ ok: true, upserted: items.length, counts, elapsedSec: parseFloat(elapsed) });
}
