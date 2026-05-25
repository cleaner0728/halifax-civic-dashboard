// Multi-source Nova Scotia news feeds. Last 24h, sorted newest-first.

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
    { url: 'https://halifax.citynews.ca/feed', name: 'CityNews Halifax' },
    { url: 'http://161.153.114.126:1201/ctv/nova-scotia', name: 'CTV Nova Scotia' },
  ];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const SOURCE_TIMEOUT_MS = 8_000;

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
