// POST /api/reddit-briefing/generate
//
// Twice-daily rollup of r/halifax. Reads the 30 hot posts from
// public/reddit.json (kept current by the fetch-reddit workflow), asks Groq
// for a casual conversational overview, synthesizes the voice once, and
// UPSERTs into the reddit_briefing table keyed by (briefing_date, slot).
// The slot is inferred from the current Halifax local time: anything before
// 14:00 local is "morning", everything later is "evening".
//
// Called by GitHub Actions on four UTC cron times that bracket both DST
// regimes (14:30 / 15:30 for morning, 21:00 / 22:00 for evening). The
// UNIQUE(briefing_date, slot) constraint dedupes — only the first arrival
// for each slot per day writes a row; later runs no-op.
//
// Required Supabase table:
//   CREATE TABLE reddit_briefing (
//     briefing_date date NOT NULL,
//     slot          text NOT NULL CHECK (slot IN ('morning','evening')),
//     summary       text NOT NULL,
//     audio_b64     text,
//     post_count    int  NOT NULL DEFAULT 0,
//     created_at    timestamptz NOT NULL DEFAULT now(),
//     PRIMARY KEY (briefing_date, slot)
//   );

import type { NextRequest } from 'next/server';
import { fetchRedditPosts } from '@/lib/fetchers/reddit';
import { summarizeReddit, type Slot } from '@/lib/ai/reddit-roundup';
import { synthesizeSpeech } from '@/lib/ai/tts';
import { sql } from '@/lib/db';

export const maxDuration = 60;

const RETENTION_DAYS = 14;

// "What's today, in Halifax?" — returns a YYYY-MM-DD string and the slot
// implied by the current hour of the day. We split at 14:00 local so the
// 14:30 ADT / 15:30 AST morning crons both land before the cutoff, and the
// 21:00 / 22:00 evening crons both land after.
function halifaxNowParts(): { date: string; slot: Slot; hour: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = parseInt(get('hour'), 10);
  const slot: Slot = hour < 14 ? 'morning' : 'evening';
  return { date, slot, hour };
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
  const { date, slot, hour } = halifaxNowParts();

  // Dedupe: if this slot for today is already written, no-op so the
  // duplicate cron at the other DST offset doesn't overwrite the first row.
  const existing = await sql<{ briefing_date: string }[]>`
    SELECT briefing_date FROM reddit_briefing
    WHERE briefing_date = ${date} AND slot = ${slot}
  `;
  if (existing.length > 0) {
    return Response.json({ ok: true, skipped: 'already_generated', date, slot });
  }

  const { posts } = await fetchRedditPosts();
  if (posts.length === 0) {
    return Response.json({ ok: false, reason: 'no_posts', date, slot }, { status: 200 });
  }

  const summary = await summarizeReddit(posts, slot);
  if (!summary) {
    return Response.json({ ok: false, reason: 'summary_failed', date, slot }, { status: 200 });
  }

  const mp3 = await synthesizeSpeech(summary);
  const audio = mp3 ? mp3.toString('base64') : null;

  await sql`
    INSERT INTO reddit_briefing (briefing_date, slot, summary, audio_b64, post_count)
    VALUES (${date}, ${slot}, ${summary}, ${audio}, ${posts.length})
    ON CONFLICT (briefing_date, slot) DO NOTHING
  `;

  // Prune anything older than the retention window so the table stays small.
  await sql`
    DELETE FROM reddit_briefing
    WHERE briefing_date < (CURRENT_DATE - (${RETENTION_DAYS} || ' days')::interval)
  `;

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[reddit-roundup] ${date} ${slot} (hour ${hour}) — ${posts.length} posts → ${summary.length}b summary in ${elapsed}s`);
  return Response.json({
    ok: true,
    date,
    slot,
    posts: posts.length,
    summaryWords: summary.split(/\s+/).length,
    hasAudio: !!audio,
    elapsedSec: parseFloat(elapsed),
  });
}
