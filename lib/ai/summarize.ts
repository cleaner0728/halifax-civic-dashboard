// Per-article summarization via Groq's hosted Llama 3.3 70B
// (free tier: ~1k req/day, very fast). Each article is summarized once and
// cached by URL — never re-summarized. Plain REST, OpenAI-compatible body,
// no SDK. Returns null on any failure so callers can degrade.

import type { NewsItem } from '@/lib/fetchers/news';

const MODEL = 'llama-3.3-70b-versatile';
const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

type EnrichedItem = NewsItem & { articleText?: string };

async function callGroq(prompt: string, maxTokens: number): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn('[briefing] GROQ_API_KEY not set — skipping summary');
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
 * Summarize ONE article into a short spoken-word blurb (2-3 sentences),
 * suitable both for on-screen display and as a standalone TTS clip.
 */
export async function summarizeArticle(item: EnrichedItem): Promise<string | null> {
  const title = item.title ?? '(untitled)';
  const body = item.articleText
    ? item.articleText.slice(0, 3_500)
    : item.contentSnippet ?? '';

  // Without any body text there's nothing to summarize beyond the title —
  // fall back to a lightly-cleaned title rather than hallucinating.
  if (!body.trim()) return title;

  const prompt = `You are writing a short spoken news blurb for a Halifax, Nova Scotia news app. Summarize the article below in 2 to 3 sentences for a text-to-speech voice.

Rules:
- Natural, conversational prose meant to be heard, not read.
- Include the key facts: who, what, where, and any important numbers.
- Plain text ONLY: no markdown, no emoji, no URLs, no source attributions.
- Do NOT add a preamble like "Here's a summary" — output only the blurb itself.
- Do not invent anything not in the article.

Title: ${title}

${body}`;

  const summary = await callGroq(prompt, 300);
  return summary ?? title;
}
