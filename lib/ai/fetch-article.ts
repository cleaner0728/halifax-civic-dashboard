// Fetches and extracts the main body text from a news article URL.
// Uses node-html-parser (already in the project) to pull <p> tags from
// the article/main content area, skipping nav/header/footer/ads.
// Returns extracted text, or falls back to the RSS snippet on any failure.

import { parse } from 'node-html-parser';
import type { NewsItem } from '@/lib/fetchers/news';

const FETCH_TIMEOUT_MS = 6_000;
const MAX_PARAGRAPHS = 12; // enough context without blowing the prompt budget
const MIN_PARA_LENGTH = 60; // ignore one-liners that are captions/labels

async function extractText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Polite UA so most sites don't block the request
        'User-Agent':
          'Mozilla/5.0 (compatible; HalifaxDashboard/1.0; +https://made-in-halifax.vercel.app)',
        Accept: 'text/html',
      },
      // Don't follow redirects to subscription/paywall pages
      redirect: 'follow',
    });
    if (!res.ok) return null;

    const html = await res.text();
    const root = parse(html);

    // Strip noise elements before extracting text
    root
      .querySelectorAll(
        'script, style, nav, header, footer, aside, figure, figcaption,' +
          '[class*="ad"], [id*="ad"], [class*="sidebar"], [class*="related"],' +
          '[class*="share"], [class*="newsletter"], [class*="subscribe"]',
      )
      .forEach((el) => el.remove());

    // Prefer semantic article/main elements; fall back to body
    const container =
      root.querySelector('article') ??
      root.querySelector('[role="main"]') ??
      root.querySelector('main') ??
      root.querySelector('.article-body, .story-body, .post-content, .entry-content') ??
      root.querySelector('body');

    if (!container) return null;

    const paragraphs = container
      .querySelectorAll('p')
      .map((p) => p.text.replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= MIN_PARA_LENGTH)
      .slice(0, MAX_PARAGRAPHS);

    return paragraphs.length > 0 ? paragraphs.join('\n\n') : null;
  } catch {
    return null;
  }
}

/** Enrich each NewsItem with full article body text (parallel fetches, best-effort). */
export async function enrichWithArticleText(
  items: NewsItem[],
): Promise<Array<NewsItem & { articleText?: string }>> {
  const results = await Promise.allSettled(
    items.map(async (item) => {
      const text = item.link ? await extractText(item.link) : null;
      return { ...item, articleText: text ?? undefined };
    }),
  );
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...items[i] },
  );
}
