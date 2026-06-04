// Thrice-daily r/halifax rollup. Runs on a GitHub Actions runner because
// the full synthesis (Groq summary + ~3 minutes of TTS audio) exceeds
// Vercel's 60-second function timeout on Hobby. Action runners have no
// such cap, so we do everything here and write the row straight to
// Supabase via the same connection string the Next app uses.
//
// Required workflow secrets:
//   GROQ_API_KEY        same key Vercel uses for the news briefing
//   SUPABASE_DB_URL     transaction-pooler URL (port 6543) — must match
//                       the one Vercel has set, since both write to the
//                       same article_summary / reddit_briefing tables
//
// Slot resolution (priority):
//   1. --slot=<name> CLI arg or SLOT env var (set by the workflow when
//      triggered with an explicit `inputs.slot` value from the VPS cron)
//   2. fall back to bucketing the current Halifax hour:
//        hour < 14   → morning      (target cron: 11:30 local)
//        14 ≤ hour < 21 → evening   (target cron: 18:00 local)
//        hour ≥ 21   → late_night   (target cron: 23:00 local)
//
// The PRIMARY KEY (briefing_date, slot) lets duplicate triggers no-op.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TTS_VOICE = 'en-US-AndrewMultilingualNeural';
const TARGET_WORDS = 450;
const RETENTION_DAYS = 14;

const VALID_SLOTS = ['morning', 'evening', 'late_night'];

function halifaxNowParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = parseInt(get('hour'), 10);
  // Three time buckets aligned with the target cron times:
  //   11:30 local → hour 11  → morning
  //   18:00 local → hour 18  → evening
  //   23:00 local → hour 23  → late_night
  const slot = hour < 14 ? 'morning' : hour < 21 ? 'evening' : 'late_night';
  return { date, slot, hour };
}

// Slot resolution: prefer an explicit argument (passed by the workflow when
// triggered by the VPS cron — exact and unambiguous), fall back to bucketing
// the current Halifax hour (used when run manually with no input).
function resolveSlot(explicit) {
  if (!explicit) return halifaxNowParts();
  if (!VALID_SLOTS.includes(explicit)) {
    throw new Error(`invalid slot "${explicit}" — expected one of ${VALID_SLOTS.join(', ')}`);
  }
  const { date, hour } = halifaxNowParts();
  return { date, slot: explicit, hour };
}

function slotGreeting(slot) {
  if (slot === 'morning') return 'a midday catch-up on what people are talking about so far today';
  if (slot === 'evening') return 'an evening wrap-up of what people have been buzzing about today';
  return 'a late-night recap of how the day played out on the subreddit';
}

async function summarizeWithGroq(posts, slot) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const lines = posts
    .slice(0, 30)
    .map((p, i) => {
      const flair = p.flair ? `[${p.flair}] ` : '';
      return `${i + 1}. ${flair}${p.title}  (score ${p.score}, ${p.numComments} comments)`;
    })
    .join('\n');

  const prompt = `You are a friend who reads r/halifax every day and is giving someone ${slotGreeting(slot)}. Read the list of posts below and tell them, in a relaxed conversational tone, what Halifax is like today: what people are talking about, what's bothering them, what's exciting, any patterns you notice across the threads.

Rules:
- Conversational, friendly, like you're chatting with a friend over coffee. Light humour is fine; don't force it.
- Spoken-word prose meant to be HEARD, not read. No lists, no markdown, no headings, no emoji.
- Group related threads together — if four posts are about the same construction project, mention it once with that context.
- Mention specific things when they stand out (place names, events, recurring complaints), but don't try to cover every post. Skim the high-signal stuff.
- Aim for about ${TARGET_WORDS} words — long enough to feel substantive, short enough to fit in roughly three minutes of speech.
- Don't open with "Here's a summary" or "Welcome" — just dive in naturally, like you're picking up a conversation.
- Don't invent facts that aren't in the post titles. If something is unclear, say it vaguely ("someone's asking about…") rather than guessing.
- Plain text only.

Posts:
${lines}`;

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 900,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('Groq returned empty content');
  return text;
}

async function synthesizeSpeech(text) {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    const chunks = [];
    for await (const chunk of audioStream) chunks.push(chunk);
    if (chunks.length === 0) throw new Error('Edge TTS returned no audio');
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('SUPABASE_DB_URL is not set');
    process.exit(1);
  }

  const t0 = Date.now();
  // Allow the slot to be passed explicitly via env (set by the workflow
  // when triggered through workflow_dispatch with an `inputs.slot` value)
  // or as a CLI arg, e.g. `node generate-reddit-briefing.mjs --slot=evening`.
  // Falls back to bucketing the current Halifax hour.
  const argSlot = process.argv.find((a) => a.startsWith('--slot='))?.split('=')[1];
  const explicit = process.env.SLOT?.trim() || argSlot?.trim() || null;
  const { date, slot, hour } = resolveSlot(explicit);
  console.log(`[reddit-roundup] target slot: ${date} ${slot} (Halifax hour ${hour}${explicit ? ', explicit' : ', inferred'})`);

  const sql = postgres(dbUrl, { prepare: false, max: 2 });
  try {
    const existing = await sql`
      SELECT briefing_date FROM reddit_briefing
      WHERE briefing_date = ${date} AND slot = ${slot}
    `;
    if (existing.length > 0) {
      console.log(`[reddit-roundup] ${date} ${slot} already exists — no-op`);
      return;
    }

    const raw = await readFile(resolve('public/reddit.json'), 'utf-8');
    const data = JSON.parse(raw);
    const posts = Array.isArray(data?.posts) ? data.posts : [];
    if (posts.length === 0) {
      console.error('[reddit-roundup] public/reddit.json has 0 posts — aborting');
      process.exit(1);
    }
    console.log(`[reddit-roundup] ${posts.length} posts read from public/reddit.json`);

    const tSummary = Date.now();
    const summary = await summarizeWithGroq(posts, slot);
    console.log(`[reddit-roundup] summary: ${summary.split(/\s+/).length} words in ${((Date.now() - tSummary) / 1000).toFixed(1)}s`);

    const tTts = Date.now();
    const mp3 = await synthesizeSpeech(summary);
    const audio = mp3.toString('base64');
    console.log(`[reddit-roundup] audio: ${mp3.length} bytes in ${((Date.now() - tTts) / 1000).toFixed(1)}s`);

    await sql`
      INSERT INTO reddit_briefing (briefing_date, slot, summary, audio_b64, post_count)
      VALUES (${date}, ${slot}, ${summary}, ${audio}, ${posts.length})
      ON CONFLICT (briefing_date, slot) DO NOTHING
    `;

    await sql`
      DELETE FROM reddit_briefing
      WHERE briefing_date < (CURRENT_DATE - (${RETENTION_DAYS} || ' days')::interval)
    `;

    console.log(`[reddit-roundup] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error('[reddit-roundup] failed:', err);
  process.exit(1);
});
