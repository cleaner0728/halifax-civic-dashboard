// Fetches and extracts the main body text from a news article URL, using a
// three-tier strategy so it works across server-rendered AND JS-rendered sites:
//
//   1. Direct fetch → JSON-LD `articleBody` (modern news sites embed this for SEO)
//   2. Direct fetch → <p> tags inside <article>/<main>
//   3. Jina Reader (https://r.jina.ai) — renders JS + proxies from Jina's own
//      servers, so it bypasses both JS-only shells (CTV) and IP blocks (Haligonia)
//
// Returns extracted text, or null. Best-effort: never throws.

import { parse } from 'node-html-parser';
import type { NewsItem } from '@/lib/fetchers/news';

const DEFAULT_FETCH_TIMEOUT_MS = 6_000;
const DEFAULT_MAX_PARAGRAPHS   = 12;
const DEFAULT_MAX_CHARS        = 1_200;
const MIN_PARA_LENGTH          = 60;
const MIN_BODY_LENGTH          = 200; // reject results too short to be an article

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-CA,en;q=0.9',
};

// ── Tier 1+2: direct fetch ───────────────────────────────────────────────────
async function tryDirect(
  url: string,
  timeoutMs: number,
  maxParagraphs: number,
): Promise<string | null> {
  let html: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const root = parse(html);

  // Tier 1: JSON-LD articleBody (CTV, many CMS-driven sites)
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const json = JSON.parse(script.text);
      const nodes = Array.isArray(json) ? json : json['@graph'] ?? [json];
      for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
        const body = node?.articleBody;
        if (typeof body === 'string' && body.length >= MIN_BODY_LENGTH) {
          return body.replace(/\s+/g, ' ').trim();
        }
      }
    } catch {
      // malformed JSON-LD — ignore
    }
  }

  // Tier 2: <p> tags in the main content area
  root
    .querySelectorAll(
      'script, style, nav, header, footer, aside, figure, figcaption,' +
        '[class*="ad"], [id*="ad"], [class*="sidebar"], [class*="related"],' +
        '[class*="share"], [class*="newsletter"], [class*="subscribe"]',
    )
    .forEach((el) => el.remove());

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
    .slice(0, maxParagraphs);

  const joined = paragraphs.join('\n\n');
  return joined.length >= MIN_BODY_LENGTH ? joined : null;
}

// ── Tier 3: Jina Reader fallback ─────────────────────────────────────────────
async function tryJina(url: string, timeoutMs: number): Promise<string | null> {
  const headers: Record<string, string> = { Accept: 'text/plain' };
  const key = process.env.JINA_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`; // optional — higher rate limit

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers,
    });
    if (!res.ok) {
      console.log(`[article] jina ${url.slice(0, 50)} → HTTP ${res.status}`);
      return null;
    }
    let text = await res.text();
    // Jina prepends "Title:/URL Source:/Markdown Content:" metadata — strip to body.
    const marker = text.indexOf('Markdown Content:');
    if (marker !== -1) text = text.slice(marker + 'Markdown Content:'.length);
    text = text.replace(/\s+/g, ' ').trim();
    return text.length >= MIN_BODY_LENGTH ? text : null;
  } catch (e) {
    console.log(`[article] jina ${url.slice(0, 50)} → ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function extractText(
  url: string,
  timeoutMs: number,
  maxParagraphs: number,
  maxChars: number,
): Promise<string | null> {
  // Tier 1+2: fast direct fetch
  const direct = await tryDirect(url, timeoutMs, maxParagraphs);
  if (direct) {
    console.log(`[article] direct ✓ ${url.slice(0, 50)} (${direct.length} chars)`);
    return direct.slice(0, maxChars);
  }
  // Tier 3: Jina fallback (slower, but handles JS/IP-blocked sites)
  const jina = await tryJina(url, Math.max(timeoutMs, 20_000));
  if (jina) {
    console.log(`[article] jina ✓ ${url.slice(0, 50)} (${jina.length} chars)`);
    return jina.slice(0, maxChars);
  }
  console.log(`[article] ✗ ${url.slice(0, 50)} (all tiers failed)`);
  return null;
}

// Bounded-concurrency map so we don't fire 15 Jina requests at once (rate limit).
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export type FetchConfig = {
  maxArticles?: number;
  timeoutMs?: number;
  maxParagraphs?: number;
  maxChars?: number;
  /** Parallel fetch workers (default 5) */
  concurrency?: number;
};

/** Enrich each NewsItem with full article body text (best-effort, bounded concurrency). */
export async function enrichWithArticleText(
  items: NewsItem[],
  config: FetchConfig = {},
): Promise<Array<NewsItem & { articleText?: string }>> {
  const {
    maxArticles = 8,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    maxParagraphs = DEFAULT_MAX_PARAGRAPHS,
    maxChars = DEFAULT_MAX_CHARS,
    concurrency = 5,
  } = config;

  const capped = items.slice(0, maxArticles);
  return mapLimit(capped, concurrency, async (item) => {
    const text = item.link
      ? await extractText(item.link, timeoutMs, maxParagraphs, maxChars)
      : null;
    return { ...item, articleText: text ?? undefined };
  });
}
