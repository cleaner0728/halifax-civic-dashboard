// Fetches upcoming events from our Supabase database.
// Results are cached for 1 hour via unstable_cache — events update daily
// via the scraper, so per-request freshness is unnecessary.

import { unstable_cache } from 'next/cache';
import { sql } from '@/lib/db';

export type HalifaxEvent = {
  url: string;
  title: string;
  summary: string | null;
  start_at: string;         // ISO timestamptz string
  end_at: string | null;
  date_text: string | null; // human-readable date; a range ("X - Y") = multi-day
  time_text: string | null;
  price_range: string | null;
  categories: string[];
  venue_name: string | null;
  venue_address: string | null;
  organizer_name: string | null;
  website: string | null;
  tickets_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
};

async function _fetchEvents(): Promise<HalifaxEvent[]> {
  const rows = await sql<HalifaxEvent[]>`
    SELECT
      url, title, summary,
      start_at, end_at, date_text, time_text, price_range,
      categories,
      venue_name, venue_address,
      organizer_name,
      website, tickets_url,
      facebook_url, instagram_url, twitter_url
    FROM events
    WHERE
      -- All-day events are stored with end_at = start_at at local midnight, so
      -- a plain end_at > now() would drop them at 00:00 of their own day. Keep
      -- them visible through the whole day by comparing the Halifax calendar
      -- date instead.
      (end_at IS NOT NULL AND end_at = start_at
        AND (end_at AT TIME ZONE 'America/Halifax')::date
            >= (now() AT TIME ZONE 'America/Halifax')::date)
      OR
      -- Timed events: not yet expired (still running or starts in the future).
      (end_at IS NOT NULL AND end_at <> start_at AND end_at > now())
      OR
      (end_at IS NULL AND start_at > now() - INTERVAL '2 days')
    ORDER BY start_at ASC
  `;
  return rows;
}

export const fetchEvents = unstable_cache(_fetchEvents, ['halifax-events'], {
  revalidate: 3600, // 1 hour
});
