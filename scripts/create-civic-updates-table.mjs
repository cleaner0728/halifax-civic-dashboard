// Creates the generic `civic_updates` table — one row per item across the
// four City Live feeds (ferry / transit / incidents / hrm_news). Idempotent:
// safe to run repeatedly. Reads SUPABASE_DB_URL from .env.local.
//
//   node scripts/create-civic-updates-table.mjs

import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)?.[1].trim();
if (!url) throw new Error('SUPABASE_DB_URL not found in .env.local');

const sql = postgres(url, { prepare: false });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS civic_updates (
      id            text PRIMARY KEY,
      feed          text NOT NULL,
      title         text NOT NULL,
      body          text,
      url           text,
      published_at  timestamptz,
      first_seen_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at  timestamptz NOT NULL DEFAULT now(),
      payload       jsonb,
      created_at    timestamptz NOT NULL DEFAULT now(),
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS civic_updates_feed_lastseen_idx
      ON civic_updates (feed, last_seen_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS civic_updates_feed_firstseen_idx
      ON civic_updates (feed, first_seen_at DESC)
  `;
  console.log('✓ civic_updates table + indexes ready');

  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'civic_updates'
    ORDER BY ordinal_position
  `;
  cols.forEach((c) => console.log(`  ${c.column_name} : ${c.data_type}`));
} finally {
  await sql.end();
}
