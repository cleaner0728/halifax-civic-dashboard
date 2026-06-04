// One-shot roundup of r/halifax posts — twice per day. Takes the ~30 hot
// posts (title, flair, score, comments) and asks Groq for a casual, spoken
// "what's Halifax talking about" overview in a friendly chatting tone.
// Length is tuned for ~3 minutes of TTS at the existing Edge voice rate
// (roughly 150-160 wpm → ~450 words).

import type { RedditPost } from '@/lib/fetchers/reddit';

const MODEL = 'llama-3.3-70b-versatile';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const TARGET_WORDS = 450;

async function callGroq(prompt: string, maxTokens: number): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('[reddit-roundup] GROQ_API_KEY not set — skipping');
    return null;
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      console.error('[reddit-roundup] Groq error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').trim();
    return text || null;
  } catch (e) {
    console.error('[reddit-roundup] Groq fetch failed', e);
    return null;
  }
}

export type Slot = 'morning' | 'evening';

function slotGreeting(slot: Slot): string {
  return slot === 'morning'
    ? 'a midday catch-up on what people are talking about so far today'
    : 'an evening wrap-up of what people have been buzzing about today';
}

export async function summarizeReddit(
  posts: RedditPost[],
  slot: Slot,
): Promise<string | null> {
  if (posts.length === 0) return null;

  // Compact, model-friendly listing. Score and comment counts give the model
  // a sense of which threads are actually loud vs. just present.
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

  // ~650 tokens is plenty of room for 450 words with overhead.
  return callGroq(prompt, 900);
}
