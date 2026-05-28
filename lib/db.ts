// Supabase PostgreSQL connection for server-side use only.
// Uses the transaction pooler (port 6543) which is serverless-safe.
// `prepare: false` is required — the transaction pooler doesn't support
// named prepared statements.

import postgres from 'postgres';

declare global {
  // eslint-disable-next-line no-var
  var _sql: ReturnType<typeof postgres> | undefined;
}

function createSql() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error('SUPABASE_DB_URL is not set');
  return postgres(url, { prepare: false, max: 3 });
}

// Reuse the connection across hot reloads in development.
export const sql = globalThis._sql ?? createSql();
if (process.env.NODE_ENV !== 'production') globalThis._sql = sql;
