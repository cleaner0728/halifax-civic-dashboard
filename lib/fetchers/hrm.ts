// halifax.ca municipal news + HRFE (fire/emergency) incident feeds.

import Parser from 'rss-parser';
import { HFX_TZ, isSameDay } from '@/lib/date';
import { stripHtml } from '@/lib/html';

export type HrmItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
};

export async function fetchHrmNews(): Promise<{ items: HrmItem[]; dateLabel: string }> {
  const parser = new Parser();
  try {
    const feed = await parser.parseURL('https://www.halifax.ca/news/rss-feed');
    const allItems = feed.items || [];

    // Try today first, then go back day by day until we find content (up to 14 days)
    const today = new Date();
    for (let daysBack = 0; daysBack < 14; daysBack++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - daysBack);

      const matchingItems = allItems.filter((item) => {
        const pubDate = item.pubDate || item.isoDate;
        return pubDate ? isSameDay(pubDate, targetDate) : false;
      });

      if (matchingItems.length > 0) {
        const dateLabel = targetDate.toLocaleDateString('en-US', {
          timeZone: HFX_TZ,
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

        return {
          dateLabel,
          items: matchingItems.map((item) => ({
            title: item.title?.trim(),
            link: item.link,
            pubDate: item.pubDate || item.isoDate,
            description: item.contentSnippet || (item.content ? stripHtml(item.content) : ''),
          })),
        };
      }
    }

    return { items: [], dateLabel: 'No recent updates' };
  } catch (e) {
    console.error('Failed to fetch HRM news:', e);
    return { items: [], dateLabel: 'Error loading' };
  }
}

export async function fetchHrfeIncidents(): Promise<HrmItem[]> {
  const parser = new Parser();
  try {
    const feed = await parser.parseURL(
      'https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed/rss.xml',
    );
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    return (feed.items || [])
      .filter((item) => {
        const d = item.pubDate || item.isoDate;
        return d ? new Date(d) > cutoff : false;
      })
      .map((item) => ({
        title: item.title?.trim(),
        link: item.link,
        pubDate: item.pubDate || item.isoDate,
        description: item.contentSnippet || (item.content ? stripHtml(item.content) : ''),
      }));
  } catch (e) {
    console.error('Failed to fetch HRFE incidents:', e);
    return [];
  }
}
