// Multi-source Nova Scotia news feeds. Last 24h, sorted newest-first.

import Parser from 'rss-parser';

type CustomFeed = Record<string, never>;
type CustomItem = {
  'media:thumbnail'?: { $: { url: string } };
  'media:content'?: { $: { url: string; medium?: string } } | Array<{ $: { url: string; medium?: string } }>;
  enclosure?: { url: string; type?: string };
  content?: string;
};

export type NewsItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  imageUrl?: string;
  source?: string;
};

function getImageUrl(item: CustomItem & { enclosure?: { url: string; type?: string } }): string | undefined {
  if (item['media:thumbnail']?.$?.url) {
    return item['media:thumbnail'].$.url;
  }
  const mediaContent = item['media:content'];
  if (Array.isArray(mediaContent)) {
    const imageMedia = mediaContent.find(m => m.$?.url && (!m.$?.medium || m.$?.medium === 'image'));
    if (imageMedia?.$?.url) return imageMedia.$.url;
  } else if (mediaContent?.$?.url) {
    return mediaContent.$.url;
  }
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }
  if (item.content) {
    const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

export async function fetchNews(): Promise<{ items: NewsItem[] }> {
  const parser = new Parser<CustomFeed, CustomItem>({
    customFields: {
      item: [
        ['media:thumbnail', 'media:thumbnail', { keepArray: false }],
        ['media:content', 'media:content', { keepArray: true }],
      ],
    },
  });

  const sources = [
    { url: 'https://www.cbc.ca/webfeed/rss/rss-canada-novascotia', name: 'CBC Nova Scotia' },
    { url: 'https://halifaxexaminer.ca/feed/', name: 'Halifax Examiner' },
    { url: 'https://globalnews.ca/halifax/feed/', name: 'Global News Halifax' },
  ];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const allItems: NewsItem[] = [];
  await Promise.allSettled(
    sources.map(async ({ url, name }) => {
      const feed = await parser.parseURL(url);
      for (const item of feed.items || []) {
        const d = item.pubDate || item.isoDate;
        if (!d || new Date(d) <= cutoff) continue;
        allItems.push({
          title: item.title,
          link: item.link,
          pubDate: d,
          contentSnippet: item.contentSnippet,
          imageUrl: getImageUrl(item),
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
