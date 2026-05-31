// News summarization via Google Gemini Flash (free tier: 1,500 req/day).
// Plain REST — no SDK dependency. Returns spoken-word prose suitable for TTS,
// or null on any failure (missing key, API error) so callers can degrade.

import type { NewsItem } from '@/lib/fetchers/news';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type EnrichedItem = NewsItem & { articleText?: string };

export async function summarizeNews(items: EnrichedItem[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[briefing] GEMINI_API_KEY not set — skipping summary');
    return null;
  }
  if (items.length === 0) return null;

  // Build per-article context blocks. If we scraped full body text, include it;
  // otherwise fall back to the RSS snippet. Cap at 8 articles so the prompt
  // stays within a sensible token budget (~4K input tokens max).
  const articleBlocks = items
    .slice(0, 8)
    .map((it, i) => {
      const title = it.title ?? '(untitled)';
      const body = it.articleText
        ? it.articleText.slice(0, 1_200) // ~300 tokens per article max
        : it.contentSnippet ?? '(no content available)';
      return `--- Article ${i + 1} ---\nTitle: ${title}\n${body}`;
    })
    .join('\n\n');

  const fullArticleCount = items.slice(0, 8).filter((it) => it.articleText).length;
  console.log(`[briefing] summarizing ${items.slice(0,8).length} articles (${fullArticleCount} with full text)`);

  const prompt = `You are a local radio news anchor for Halifax, Nova Scotia. Below are the latest news articles from the past few hours, some with full article text. Write a natural, spoken-word news briefing as continuous prose for a text-to-speech voice.

Rules:
- Open with a short greeting such as "Here's your Halifax news update."
- Lead with the most important stories; group related ones together.
- Draw from the article body text, not just the title — include key facts, numbers, names.
- Conversational and concise: 130-180 words (about 50-65 seconds spoken).
- Plain text ONLY. No markdown, no bullet points, no emoji, no headings, no URLs, no source names.
- Do not invent facts beyond what is provided.
- End with a brief sign-off such as "That's the latest for now."

Articles:
${articleBlocks}`;

  try {
    const res = await fetch(`${ENDPOINT}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 900,
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
