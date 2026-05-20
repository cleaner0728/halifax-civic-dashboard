// Halifax Transit service-disruption scraping. The official page renders
// detours as accordions; we parse them out so the dashboard can show details
// without iframing the whole page.

import Parser from 'rss-parser';
import { parse as parseHtml } from 'node-html-parser';

export type TransitDetour = {
  title: string;
  routes: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  time?: string;
  location?: string;
  summary?: string;
};

function extractStrongField(html: string, labelPattern: string): string {
  const regex = new RegExp(`<strong>\\s*${labelPattern}\\s*<\\/strong>([^<]*)`, 'i');
  const m = html.match(regex);
  return m ? m[1].trim() : '';
}

function extractDetourSummary(html: string): string {
  const hrIdx = html.indexOf('<hr>');
  if (hrIdx === -1) return '';
  const afterHr = html.slice(hrIdx + 4);
  const tabsIdx = afterHr.indexOf('<div class="bootstrap-tabs">');
  const portion = tabsIdx !== -1 ? afterHr.slice(0, tabsIdx) : afterHr;
  return portion
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s*Buses will detour as follows:\s*$/i, '')
    .trim();
}

// Lightweight signal: is there any transit RSS activity in the last 2 days?
// Used by the UI to decide whether to surface a "view source" link.
export async function fetchTransitRss(): Promise<boolean> {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://www.halifax.ca/page-published-feed/15879');
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    return (feed.items || []).some((item) => {
      const d = item.pubDate || item.isoDate;
      return d ? new Date(d) > cutoff : false;
    });
  } catch {
    return false;
  }
}

export async function fetchTransitDetours(): Promise<TransitDetour[]> {
  try {
    const res = await fetch(
      'https://www.halifax.ca/transportation/halifax-transit/service-disruptions',
      { next: { revalidate: 900 } },
    );
    if (!res.ok) return [];
    const html = await res.text();

    const detourStart = html.indexOf('<h2>Detours</h2>');
    if (detourStart === -1) return [];
    const stopStart = html.indexOf('<h2>Stop Closures</h2>');
    const section = stopStart !== -1 ? html.slice(detourStart, stopStart) : html.slice(detourStart);

    const root = parseHtml(section);
    const results: TransitDetour[] = [];
    for (const accordion of root.querySelectorAll('.paragraph--type--accordion')) {
      const contentDiv = accordion.querySelector('.u-text-lighter');
      if (!contentDiv) continue;
      const inner = contentDiv.innerHTML;
      const title = contentDiv.querySelector('h3')?.text.trim() ?? '';
      if (!title) continue;
      results.push({
        title,
        routes: extractStrongField(inner, 'Route(?:\\(s\\)|s)?:'),
        date: extractStrongField(inner, 'Date:') || undefined,
        startDate: extractStrongField(inner, 'Start Date:') || undefined,
        endDate: extractStrongField(inner, 'End Date:') || undefined,
        time: extractStrongField(inner, 'Time:') || undefined,
        location: extractStrongField(inner, 'Location:') || undefined,
        summary: extractDetourSummary(inner) || undefined,
      });
    }
    return results;
  } catch (e) {
    console.error('Failed to fetch transit disruptions:', e);
    return [];
  }
}
