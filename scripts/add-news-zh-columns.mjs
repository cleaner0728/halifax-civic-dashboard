// Adds Chinese summary + audio columns to article_summary. Idempotent —
// safe to run repeatedly. Reads SUPABASE_DB_URL from .env.local.
//
//   node scripts/add-news-zh-columns.mjs

import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const url = readFileSync('.env.local', 'utf-8').match(/SUPABASE_DB_URL=(.+)/)?.[1].trim();
if (!url) throw new Error('SUPABASE_DB_URL not found in .env.local');

const sql = postgres(url, { prepare: false });

try {
  await sql`ALTER TABLE article_summary ADD COLUMN IF NOT EXISTS summary_zh   text`;
  await sql`ALTER TABLE article_summary ADD COLUMN IF NOT EXISTS audio_zh_b64 text`;
  console.log('✓ article_summary.summary_zh + audio_zh_b64 ready');

  const cols = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'article_summary'
    ORDER BY ordinal_position
  `;
  cols.forEach((c) => console.log(`  ${c.column_name} : ${c.data_type}`));
} finally {
  await sql.end();
}
