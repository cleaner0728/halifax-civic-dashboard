// Per-article summarization via Google Gemini Flash (free tier: 1,500 req/day).
// Each article is summarized once and cached by URL — never re-summarized.
// Plain REST, no SDK. Returns null on any failure so callers can degrade.

import type { NewsItem } from '@/lib/fetchers/news';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type EnrichedItem = NewsItem & { articleText?: string };

async function callGemini(prompt: string, maxOutputTokens: number): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[briefing] GEMINI_API_KEY not set — skipping summary');
    return null;
  }
  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens,
          // Disable thinking — summarization needs no reasoning, and thinking
          // tokens eat the output budget causing truncation.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) {
      console.error('[briefing] Gemini error', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts as { text?: string }[] | undefined;
    const text = (parts ?? []).map((p) => p.text ?? '').join('').trim();
    return text || null;
  } catch (e) {
    console.error('[briefing] Gemini fetch failed', e);
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

  const summary = await callGemini(prompt, 300);
  return summary ?? title;
}
