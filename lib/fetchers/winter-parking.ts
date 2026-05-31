import Parser from 'rss-parser';

export type WinterParkingBan = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
};

const FEED_URL = 'https://www.halifax.ca/news/category/rss-feed?category=22';

export async function fetchWinterParkingBan(): Promise<WinterParkingBan | null> {
  const parser = new Parser();
  const feed = await Promise.race([
    parser.parseURL(FEED_URL),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 8_000),
    ),
  ]);

  const items = feed.items ?? [];
  if (items.length === 0) return null;

  // Newest item first (feed is usually already sorted, but sort to be safe)
  items.sort((a, b) => {
    const da = a.pubDate || a.isoDate || '';
    const db = b.pubDate || b.isoDate || '';
    return new Date(db).getTime() - new Date(da).getTime();
  });

  const item = items[0];
  return {
    title: item.title ?? 'Winter Parking Ban',
    link: item.link ?? 'https://www.halifax.ca/transportation/parking/winter-parking-ban',
    pubDate: item.pubDate ?? item.isoDate ?? '',
    description: item.contentSnippet ?? item.content ?? '',
  };
}
