import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const sql = postgres(url, { prepare: false });

try {
  console.log('=== reddit_posts stats ===');
  const postStats = await sql`
    SELECT
      COUNT(*)::int AS total,
      MIN(to_timestamp(created_utc)) AS oldest_post,
      MAX(to_timestamp(created_utc)) AS newest_post,
      MIN(last_fetched_at) AS oldest_fetch,
      MAX(last_fetched_at) AS newest_fetch,
      SUM(num_comments)::int AS total_comments_claimed
    FROM reddit_posts
  `;
  console.log(postStats[0]);

  console.log('\n=== reddit_comments stats ===');
  const commentStats = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(DISTINCT post_id)::int AS posts_with_comments,
      MIN(to_timestamp(created_utc)) AS oldest,
      MAX(to_timestamp(created_utc)) AS newest,
      MIN(fetched_at) AS oldest_fetch,
      MAX(fetched_at) AS newest_fetch,
      AVG(score)::numeric(10,2) AS avg_score
    FROM reddit_comments
  `;
  console.log(commentStats[0]);

  console.log('\n=== top 5 posts by comments fetched ===');
  const topPosts = await sql`
    SELECT p.id, p.title, p.num_comments AS claimed,
           (SELECT COUNT(*)::int FROM reddit_comments c WHERE c.post_id = p.id) AS stored
    FROM reddit_posts p
    ORDER BY stored DESC NULLS LAST
    LIMIT 5
  `;
  topPosts.forEach(p => console.log(`  [${p.id}] stored=${p.stored} claimed=${p.claimed} | ${p.title.slice(0, 70)}`));

  console.log('\n=== posts with zero stored comments ===');
  const zero = await sql`
    SELECT COUNT(*)::int AS n FROM reddit_posts p
    WHERE NOT EXISTS (SELECT 1 FROM reddit_comments c WHERE c.post_id = p.id)
  `;
  console.log(`  ${zero[0].n} posts have no comments stored`);

  console.log('\n=== reddit_briefing recent ===');
  const briefs = await sql`
    SELECT briefing_date, slot, post_count, length(summary) AS summary_chars,
           (audio_b64 IS NOT NULL) AS has_audio, created_at
    FROM reddit_briefing
    ORDER BY briefing_date DESC, slot DESC
  `;
  briefs.forEach(b => console.log(`  ${b.briefing_date.toISOString().slice(0,10)} ${b.slot.padEnd(8)} posts=${b.post_count} chars=${b.summary_chars} audio=${b.has_audio}`));
} finally {
  await sql.end();
}
