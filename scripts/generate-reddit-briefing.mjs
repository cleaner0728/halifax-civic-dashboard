// Twice-daily r/halifax rollup. Runs on a GitHub Actions runner because
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
// Slot is inferred from current Halifax local time: anything before 14:00
// local is "morning", everything later is "evening". The four UTC cron
// times in generate-reddit-briefing.yml bracket both DST regimes; the
// PRIMARY KEY (briefing_date, slot) lets the second arrival no-op.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TTS_VOICE = 'en-US-AndrewMultilingualNeural';
const TARGET_WORDS = 450;
const RETENTION_DAYS = 14;

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
  const slot = hour < 14 ? 'morning' : 'evening';
  return { date, slot, hour };
}

function slotGreeting(slot) {
  return slot === 'morning'
    ? 'a midday catch-up on what people are talking about so far today'
    : 'an evening wrap-up of what people have been buzzing about today';
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
  const { date, slot, hour } = halifaxNowParts();
  console.log(`[reddit-roundup] target slot: ${date} ${slot} (Halifax hour ${hour})`);

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
