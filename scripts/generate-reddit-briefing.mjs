// Thrice-daily r/halifax rollup. Runs on a GitHub Actions runner because
// the full synthesis (Groq summary + ~3 minutes of TTS audio) exceeds
// Vercel's 60-second function timeout on Hobby. Action runners have no
// such cap, so we do everything here and write the row straight to
// Supabase via the same connection string the Next app uses.
//
// The briefing is built as short per-theme segments rather than one long
// block: Groq clusters the post titles into a handful of topics, each topic
// gets its own spoken blurb, and every blurb is synthesized separately and
// the MP3s are stitched together. Short TTS sessions are far more reliable on
// the free Edge endpoint than one long ~3-minute synthesis, which gets dropped.
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
const RETENTION_HOURS = 24;

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

// Spoken opener, played first. Kept as a short fixed line (not LLM-generated) so
// the briefing always starts the same friendly way regardless of the day's posts.
function buildIntro(slot) {
  const when = slot === 'morning' ? 'so far today' : 'today';
  return `Alright, let's take a look at what everyone on the Halifax subreddit is talking about ${when}.`;
}

// Ask Groq to cluster the post titles into a handful of topics and write a short
// spoken blurb for each. Returns [{ label, blurb }]. JSON mode guarantees a
// parseable shape so we can synthesize each blurb as its own audio segment.
async function summarizeThemes(posts, slot) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY not set');

  const lines = posts
    .slice(0, 30)
    .map((p, i) => `${i + 1}. ${p.title}${p.author ? `  — by ${p.author}` : ''}`)
    .join('\n');

  const prompt = `You are a long-time r/halifax lurker giving a friend ${slotGreeting(slot)}.

Below are today's r/halifax post titles. Group them into 3 to 6 themes by topic — e.g. local news and incidents, housing and cost of living, traffic and transit, community and events, questions and advice, food and recommendations, and the funny or random stuff. Put related posts together. Skip the recurring AutoModerator megathreads (the monthly "things to do", the weekly gas post, standing resource lists) unless something genuinely notable is in them.

For each theme, write a short spoken-word blurb in the dry, self-aware, affectionately-exasperated tone of someone who's scrolled this subreddit way too long — gentle snark at the recurring tropes, but never punching down at the people posting (handle lost pets, crime, and accidents straight). Start each blurb by naturally naming the theme out loud. It is meant to be HEARD, not read: plain conversational prose, no lists, no markdown, no headings, no emoji, no hashtags, no "u/username" mentions. Don't invent anything that isn't in the titles. Aim for 50 to 90 words per theme.

Return ONLY a JSON object of exactly this shape:
{ "themes": [ { "label": "<short topic name>", "blurb": "<the spoken summary>" } ] }

Titles:
${lines}`;

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = (data?.choices?.[0]?.message?.content ?? '').trim();
  if (!content) throw new Error('Groq returned empty content');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Groq did not return valid JSON');
  }
  const themes = Array.isArray(parsed?.themes)
    ? parsed.themes
        .map((t) => ({ label: String(t?.label ?? '').trim(), blurb: String(t?.blurb ?? '').trim() }))
        .filter((t) => t.blurb)
    : [];
  if (themes.length === 0) throw new Error('Groq returned no usable themes');
  return themes;
}

// Synthesize a single piece of text, retrying the free Edge endpoint a few times.
// It intermittently throttles datacenter IPs and closes the stream with zero audio
// chunks; a fresh instance per attempt (a closed socket can't be reused) plus backoff
// rides out the transient drops.
async function synthesizeSegment(text, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text);
      const chunks = [];
      for await (const chunk of audioStream) chunks.push(chunk);
      if (chunks.length === 0) throw new Error('Edge TTS returned no audio');
      return Buffer.concat(chunks);
    } catch (err) {
      lastErr = err;
      console.warn(`[reddit-roundup] TTS attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await new Promise((r) => setTimeout(r, 2000 * i));
    } finally {
      tts.close();
    }
  }
  throw lastErr;
}

// Synthesize each segment separately and stitch the MP3s together. Splitting the
// briefing into short per-theme chunks keeps every Edge TTS session brief, which the
// free endpoint handles far more reliably than one long ~3-minute synthesis. CBR MP3
// frames concatenate cleanly for playback. If a single segment still fails after its
// retries we drop it (audio + matching text stay in sync) rather than losing the whole
// briefing; we only fail outright if nothing synthesized at all.
async function synthesizeBriefing(segments) {
  const audioParts = [];
  const textParts = [];
  for (const raw of segments) {
    const text = raw.trim();
    if (!text) continue;
    try {
      audioParts.push(await synthesizeSegment(text));
      textParts.push(text);
    } catch (err) {
      console.warn(`[reddit-roundup] dropping segment after retries: ${err.message} — "${text.slice(0, 40)}…"`);
    }
  }
  if (audioParts.length === 0) throw new Error('Edge TTS returned no audio for any segment');
  return { audio: Buffer.concat(audioParts), text: textParts.join('\n\n') };
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
    const themes = await summarizeThemes(posts, slot);
    console.log(`[reddit-roundup] ${themes.length} themes in ${((Date.now() - tSummary) / 1000).toFixed(1)}s: ${themes.map((t) => t.label).join(', ')}`);

    // Intro first, then one segment per theme — each synthesized on its own.
    const segments = [buildIntro(slot), ...themes.map((t) => t.blurb)];
    const tTts = Date.now();
    const { audio: mp3, text: summary } = await synthesizeBriefing(segments);
    const audio = mp3.toString('base64');
    console.log(`[reddit-roundup] audio: ${mp3.length} bytes from ${segments.length} segments in ${((Date.now() - tTts) / 1000).toFixed(1)}s`);

    await sql`
      INSERT INTO reddit_briefing (briefing_date, slot, summary, audio_b64, post_count)
      VALUES (${date}, ${slot}, ${summary}, ${audio}, ${posts.length})
      ON CONFLICT (briefing_date, slot) DO NOTHING
    `;

    // Prune anything older than the retention window (24h since creation)
    // so yesterday's rollups don't linger.
    await sql`
      DELETE FROM reddit_briefing
      WHERE created_at < NOW() - (${RETENTION_HOURS} || ' hours')::interval
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
