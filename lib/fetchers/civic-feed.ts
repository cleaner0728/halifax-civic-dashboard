// Reads the four City Live feeds back out of the generic `civic_updates`
// table and reconstructs the exact shapes the existing block components
// already consume (FerryAlert / TransitDetour / TransitAdjustment / HrmItem),
// so none of those components have to change.
//
// Each reader returns `null` when the table is missing, empty, or errors —
// the page treats null as "no DB data" and falls back to the live scraper
// (same DB→live degradation as reddit-db → reddit RSS). When DB data IS
// present, `hasUpdateToday` reports whether any item in the feed was first
// seen on today's Halifax calendar date — that drives the collapsed-fold dot.

import { sql } from '@/lib/db';
import { HFX_TZ, toHfxDateStr } from '@/lib/date';
import {
  fetchFerryAlerts,
  fetchTransitDetours,
  fetchTransitAdjustments,
  type FerryAlert,
  type TransitDetour,
  type TransitAdjustment,
} from './transit';
import { fetchHrfeIncidents, fetchHrmNews, type HrmItem } from './hrm';

export type CivicFeed = 'ferry' | 'transit' | 'incidents' | 'hrm_news';

// How long an item stays "active" after the cron last re-confirmed it. The
// cron runs every 20 min; 90 min tolerates a couple of missed runs before a
// resolved disruption drops off.
const FRESH_MINUTES = 90;

type Row = {
  id: string;
  feed: string;
  title: string;
  body: string | null;
  url: string | null;
  published_at: string | null;
  first_seen_at: string;
  payload: Record<string, unknown> | null;
};

// Shared query — current (recently re-confirmed) rows for one feed.
async function readRows(feed: CivicFeed): Promise<Row[] | null> {
  try {
    const rows = await sql<Row[]>`
      SELECT id, feed, title, body, url, published_at, first_seen_at, payload
      FROM civic_updates
      WHERE feed = ${feed}
        AND last_seen_at > now() - make_interval(mins => ${FRESH_MINUTES})
      ORDER BY published_at DESC NULLS LAST, first_seen_at DESC
    `;
    return rows;
  } catch (e: unknown) {
    // Missing table (SQLSTATE 42P01) in a fresh env → fall back to live.
    const code = (e as { code?: string } | null)?.code;
    if (code === '42P01') {
      console.warn('[civic-feed] civic_updates table missing — falling back');
      return null;
    }
    console.error('[civic-feed] query failed:', e);
    return null;
  }
}

// An item is "new today" if its first_seen_at lands on today's Halifax date.
function computeHasUpdateToday(rows: Row[]): boolean {
  const today = toHfxDateStr(new Date());
  return rows.some((r) => toHfxDateStr(r.first_seen_at) === today);
}

export async function fetchFerryFromDb(): Promise<{
  alerts: FerryAlert[];
  hasUpdateToday: boolean;
} | null> {
  const rows = await readRows('ferry');
  if (!rows || rows.length === 0) return null;
  return {
    alerts: rows.map((r) => ({
      title: r.title,
      body: r.body ?? '',
      moreDetailsUrl: r.url ?? undefined,
    })),
    hasUpdateToday: computeHasUpdateToday(rows),
  };
}

export async function fetchTransitFromDb(): Promise<{
  detours: TransitDetour[];
  adjustments: TransitAdjustment | null;
  hasUpdateToday: boolean;
} | null> {
  const rows = await readRows('transit');
  if (!rows || rows.length === 0) return null;

  const detours: TransitDetour[] = [];
  let adjustments: TransitAdjustment | null = null;

  for (const r of rows) {
    const p = r.payload ?? {};
    if (p.kind === 'adjustment') {
      adjustments = {
        dateLabel: String(p.dateLabel ?? ''),
        intro: r.body ?? '',
        bullets: Array.isArray(p.bullets) ? (p.bullets as string[]) : [],
        sourceUrl: r.url ?? 'https://www.halifax.ca/transportation/halifax-transit/service-adjustments',
      };
    } else {
      detours.push({
        title: r.title,
        routes: String(p.routes ?? ''),
        date: (p.date as string) ?? undefined,
        startDate: (p.startDate as string) ?? undefined,
        endDate: (p.endDate as string) ?? undefined,
        time: (p.time as string) ?? undefined,
        location: (p.location as string) ?? undefined,
        summary: r.body ?? undefined,
      });
    }
  }

  return { detours, adjustments, hasUpdateToday: computeHasUpdateToday(rows) };
}

export async function fetchIncidentsFromDb(): Promise<{
  incidents: HrmItem[];
  hasUpdateToday: boolean;
} | null> {
  const rows = await readRows('incidents');
  if (!rows) return null;

  // Match the live card's "past 60 minutes" window.
  const cutoff = Date.now() - 60 * 60 * 1000;
  const recent = rows.filter((r) => {
    if (!r.published_at) return false;
    return new Date(r.published_at).getTime() > cutoff;
  });
  if (recent.length === 0) return null;

  return {
    incidents: recent.map((r) => ({
      title: r.title,
      link: r.url ?? undefined,
      pubDate: r.published_at ?? undefined,
      description: r.body ?? undefined,
    })),
    hasUpdateToday: computeHasUpdateToday(recent),
  };
}

export async function fetchHrmNewsFromDb(): Promise<{
  items: HrmItem[];
  dateLabel: string;
  hasUpdateToday: boolean;
} | null> {
  const rows = await readRows('hrm_news');
  if (!rows || rows.length === 0) return null;

  // The live card shows a single day — the most recent Halifax date that has
  // news. Group by published date, keep the newest day's items.
  const dated = rows.filter((r) => r.published_at);
  if (dated.length === 0) return null;

  const newestDate = dated.reduce((max, r) => {
    const d = toHfxDateStr(r.published_at!);
    return d > max ? d : max;
  }, '');

  const dayRows = dated.filter((r) => toHfxDateStr(r.published_at!) === newestDate);

  const dateLabel = new Date(dayRows[0].published_at!).toLocaleDateString('en-US', {
    timeZone: HFX_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return {
    items: dayRows.map((r) => ({
      title: r.title,
      link: r.url ?? undefined,
      pubDate: r.published_at ?? undefined,
      description: r.body ?? undefined,
    })),
    dateLabel,
    hasUpdateToday: computeHasUpdateToday(dayRows),
  };
}

// ── DB-first resolvers ──────────────────────────────────────────────────────
// Each tries the DB; if the table is empty/missing/errored it falls back to
// the original live scraper so the dashboard never goes blank. The live path
// can't know first-seen history, so its hasUpdateToday is always false.

export async function resolveFerry(): Promise<{
  alerts: FerryAlert[];
  hasUpdateToday: boolean;
}> {
  const db = await fetchFerryFromDb();
  if (db) return db;
  const alerts = await fetchFerryAlerts().catch(() => []);
  return { alerts, hasUpdateToday: false };
}

export async function resolveTransit(): Promise<{
  detours: TransitDetour[];
  adjustments: TransitAdjustment | null;
  hasUpdateToday: boolean;
}> {
  const db = await fetchTransitFromDb();
  if (db) return db;
  const [detours, adjustments] = await Promise.all([
    fetchTransitDetours().catch(() => []),
    fetchTransitAdjustments().catch(() => null),
  ]);
  return { detours, adjustments, hasUpdateToday: false };
}

export async function resolveIncidents(): Promise<{
  incidents: HrmItem[];
  hasUpdateToday: boolean;
}> {
  const db = await fetchIncidentsFromDb();
  if (db) return db;
  const incidents = await fetchHrfeIncidents().catch(() => []);
  return { incidents, hasUpdateToday: false };
}

export async function resolveHrmNews(): Promise<{
  items: HrmItem[];
  dateLabel: string;
  hasUpdateToday: boolean;
}> {
  const db = await fetchHrmNewsFromDb();
  if (db) return db;
  const live = await fetchHrmNews().catch(() => ({ items: [], dateLabel: 'Error loading' }));
  return { items: live.items, dateLabel: live.dateLabel, hasUpdateToday: false };
}
