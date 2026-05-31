// News summarization via Google Gemini Flash (free tier: 1,500 req/day).
// Plain REST — no SDK dependency. Returns spoken-word prose suitable for TTS,
// or null on any failure (missing key, API error) so callers can degrade.

import type { NewsItem } from '@/lib/fetchers/news';

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type EnrichedItem = NewsItem & { articleText?: string };

export type SummarizeConfig = {
  /** Max articles to include in prompt (default 8) */
  maxArticles?: number;
  /** Max chars per article in prompt (default 1200) */
  maxCharsPerArticle?: number;
  /** Target word count range for the briefing (default "130-180") */
  wordRange?: string;
  /** Target spoken duration description (default "50-65 seconds") */
  duration?: string;
};

export async function summarizeNews(
  items: EnrichedItem[],
  config: SummarizeConfig = {},
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[briefing] GEMINI_API_KEY not set — skipping summary');
    return null;
  }
  if (items.length === 0) return null;

  const {
    maxArticles = 8,
    maxCharsPerArticle = 1_200,
    wordRange = '130-180',
    duration = '50-65 seconds',
  } = config;

  const articleBlocks = items
    .slice(0, maxArticles)
    .map((it, i) => {
      const title = it.title ?? '(untitled)';
      const body = it.articleText
        ? it.articleText.slice(0, maxCharsPerArticle)
        : it.contentSnippet ?? '(no content available)';
      return `--- Article ${i + 1} ---\nTitle: ${title}\n${body}`;
    })
    .join('\n\n');

  const used = items.slice(0, maxArticles);
  const fullCount = used.filter((it) => it.articleText).length;
  console.log(`[briefing] summarizing ${used.length} articles (${fullCount} with full text, ${maxCharsPerArticle} chars each)`);

  const prompt = `You are a local radio news anchor for Halifax, Nova Scotia. Below are the latest news articles from the past few hours, most with full article text. Write a natural, spoken-word news briefing as continuous prose for a text-to-speech voice.

Rules:
- Open with a short greeting such as "Here's your Halifax news update."
- COVER EVERY ARTICLE provided — do not omit or skip any story. Each distinct article must get its own clear mention.
- Lead with the most important stories, and group closely related ones together, but still touch on all of them.
- Draw from the article body text, not just the title — include key facts, numbers, names, quotes, and context for each story.
- Spend more time on bigger stories and a sentence or two on smaller ones, but include them all.
- Natural and flowing: ${wordRange} words (about ${duration} spoken).
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
          // Headroom for a ~3-minute briefing (~450 words ≈ 600 tokens).
          maxOutputTokens: 1_800,
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
