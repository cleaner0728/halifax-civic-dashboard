// Multi-source Nova Scotia news feeds. Last 8h, sorted newest-first.

import Parser from 'rss-parser';

export type NewsItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  source?: string;
};

export async function fetchNews(): Promise<{ items: NewsItem[] }> {
  const parser = new Parser();

  const sources = [
    { url: 'https://www.cbc.ca/webfeed/rss/rss-canada-novascotia', name: 'CBC Nova Scotia' },
    { url: 'https://halifaxexaminer.ca/feed/', name: 'Halifax Examiner' },
    { url: 'https://globalnews.ca/halifax/feed/', name: 'Global News Halifax' },
    { url: 'https://www.saltwire.com/category/nova-scotia/halifax/feed', name: 'SaltWire Halifax' },
    // TEMPORARY: plaintext HTTP + bare IP, so this feed is unencrypted and
    // tamperable in transit. The isHttpLink() guard below keeps a tampered
    // feed from injecting non-http(s) hrefs, but titles/snippets are still
    // rendered as-is — swap this for CTV's official HTTPS feed when we have
    // a stable URL.
    { url: 'http://161.153.114.126:1201/ctv/nova-scotia', name: 'CTV Nova Scotia' },
    { url: 'http://haligonia.ca/feed/', name: 'Haligonia' },
    { url: 'https://www.thecoast.ca/feed/', name: 'The Coast' },
  ];

  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000);

  const SOURCE_TIMEOUT_MS = 8_000;

  // Only http(s) links get rendered as card hrefs. Feed contents are
  // untrusted (one source is still plaintext HTTP and could be tampered
  // with in transit) — dropping anything that isn't http(s) keeps a
  // malicious feed from slipping a `javascript:` or `data:` URL into an
  // anchor the user might tap.
  const isHttpLink = (link: string | undefined): link is string => {
    if (!link) return false;
    try {
      return /^https?:$/.test(new URL(link).protocol);
    } catch {
      return false;
    }
  };

  const allItems: NewsItem[] = [];
  await Promise.allSettled(
    sources.map(async ({ url, name }) => {
      const feed = await Promise.race([
        parser.parseURL(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout: ${name}`)), SOURCE_TIMEOUT_MS),
        ),
      ]);
      for (const item of feed.items || []) {
        const d = item.pubDate || item.isoDate;
        if (!d || new Date(d) <= cutoff) continue;
        if (!isHttpLink(item.link)) continue;
        allItems.push({
          title: item.title,
          link: item.link,
          pubDate: d,
          contentSnippet: item.contentSnippet,
          source: name,
        });
      }
    }),
  );

  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return { items: allItems };
}
