// News summarization via Google Gemini Flash (free tier: 1,500 req/day).
// Plain REST — no SDK dependency. Returns spoken-word prose suitable for TTS,
// or null on any failure (missing key, API error) so callers can degrade.

import type { NewsItem } from '@/lib/fetchers/news';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function summarizeNews(items: NewsItem[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[briefing] GEMINI_API_KEY not set — skipping summary');
    return null;
  }
  if (items.length === 0) return null;

  // Cap at the 12 most recent so the prompt stays small and the briefing
  // doesn't run long. Titles + snippets give the model enough to work with.
  const headlines = items
    .slice(0, 12)
    .map((it, i) => {
      const snippet = it.contentSnippet ? ` — ${it.contentSnippet}` : '';
      return `${i + 1}. ${it.title ?? ''}${snippet}`;
    })
    .join('\n');

  const prompt = `You are a local radio news anchor for Halifax, Nova Scotia. Below are the latest headlines from the past few hours. Write a natural, spoken-word news briefing as continuous prose for a text-to-speech voice.

Rules:
- Open with a short greeting such as "Here's your Halifax news update."
- Lead with the most important stories; group related ones together.
- Conversational and concise: 110-160 words (about 45-60 seconds spoken).
- Plain text ONLY. No markdown, no bullet points, no emoji, no headings, no URLs, no source names.
- Do not invent facts beyond the headlines provided.
- End with a brief sign-off such as "That's the latest for now."

Headlines:
${headlines}`;

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
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
