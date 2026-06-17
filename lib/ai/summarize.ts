// Per-article rephrasing via Groq's hosted Llama 3.3 70B
// (free tier: ~1k req/day, very fast). Each article is rephrased once and
// cached by URL — never reprocessed. Plain REST, OpenAI-compatible body,
// no SDK. Returns null on any failure so callers can degrade.

import type { NewsItem } from '@/lib/fetchers/news';

const MODEL = 'llama-3.3-70b-versatile';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

async function callGroq(prompt: string, maxTokens: number): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('[briefing] GROQ_API_KEY not set — skipping rephrase');
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
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      console.error('[briefing] Groq error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? '').trim();
    return text || null;
  } catch (e) {
    console.error('[briefing] Groq fetch failed', e);
    return null;
  }
}

/**
 * Rephrase ONE article's RSS excerpt into natural broadcast prose,
 * suitable for on-screen display and as a standalone TTS clip.
 * Retains all substance from the original — does not compress or omit facts.
 */
export async function summarizeArticle(item: NewsItem): Promise<string | null> {
  const title = item.title ?? '(untitled)';
  const body = item.contentSnippet ?? '';

  if (!body.trim()) return title;

  const prompt = `You are a news anchor for a Halifax, Nova Scotia news app. Rephrase the news excerpt below into natural, conversational spoken prose for a text-to-speech broadcast.

Rules:
- Keep ALL the key facts and details from the original — do not omit or compress information.
- Rewrite the wording and sentence structure so it flows naturally when read aloud.
- Plain text ONLY: no markdown, no emoji, no URLs, no source attributions.
- Do NOT add a preamble like "Here's the story" — output only the rephrased text.
- Do not invent anything not in the excerpt.

Title: ${title}

${body}`;

  const result = await callGroq(prompt, 400);
  return result ?? title;
}
