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

export type FerryAlert = {
  title: string;
  body: string;            // plain-text summary, paragraphs joined with blank lines
  moreDetailsUrl?: string; // halifax.ca news link if the alert provides one
};

export type TransitAdjustment = {
  dateLabel: string;       // "May 18, 2026" lifted from the heading
  intro: string;           // first paragraph beneath the heading
  bullets: string[];       // summary bullet list, each <li> as plain text
  sourceUrl: string;
};

const DISRUPTIONS_URL = 'https://www.halifax.ca/transportation/halifax-transit/service-disruptions';
const ADJUSTMENTS_URL = 'https://www.halifax.ca/transportation/halifax-transit/service-adjustments';
const ADJUSTMENTS_FEED_URL = 'https://www.halifax.ca/page-published-feed/838035';
const ADJUSTMENTS_RECENT_DAYS = 30;

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

// Both Detours and Ferry alerts live on the same page — fetching once and
// slicing into sections keeps us at one network call per build.
async function fetchDisruptionsHtml(): Promise<string | null> {
  try {
    const res = await fetch(DISRUPTIONS_URL, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error('Failed to fetch transit disruptions page:', e);
    return null;
  }
}

export async function fetchTransitDetours(): Promise<TransitDetour[]> {
  const html = await fetchDisruptionsHtml();
  if (!html) return [];

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
}

export async function fetchFerryAlerts(): Promise<FerryAlert[]> {
  const html = await fetchDisruptionsHtml();
  if (!html) return [];

  const ferryStart = html.indexOf('<h2>Ferry</h2>');
  if (ferryStart === -1) return [];
  const detourStart = html.indexOf('<h2>Detours</h2>', ferryStart);
  const section = detourStart !== -1 ? html.slice(ferryStart, detourStart) : html.slice(ferryStart);

  const root = parseHtml(section);
  const results: FerryAlert[] = [];
  for (const accordion of root.querySelectorAll('.paragraph--type--accordion')) {
    // Title sits in the accordion button, body in .u-text-lighter
    const title = accordion.querySelector('.field--name-field-title')?.text.trim() ?? '';
    if (!title) continue;

    const contentDiv = accordion.querySelector('.u-text-lighter');
    if (!contentDiv) {
      results.push({ title, body: '' });
      continue;
    }

    // The "More details" link is duplicated across multiple <a> tags due to
    // halifax.ca's broken editor — collapse to the first valid news URL.
    let moreDetailsUrl: string | undefined;
    for (const a of contentDiv.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') ?? '';
      if (href.startsWith('/home/news/')) {
        moreDetailsUrl = `https://www.halifax.ca${href}`;
        break;
      }
      if (href.startsWith('https://www.halifax.ca/home/news/')) {
        moreDetailsUrl = href;
        break;
      }
    }

    // Strip tags, collapse the "More details: [link text]" trailer.
    const body = contentDiv
      .text
      .replace(/\s+/g, ' ')
      .replace(/More details:.*$/i, '')
      .trim();

    results.push({ title, body, moreDetailsUrl });
  }
  return results;
}

// Service Adjustments — a structured "what's changing on Date X" block that
// halifax.ca publishes ahead of major route/schedule shake-ups. We surface
// it only when the page has been touched recently (per its RSS feed) so an
// 18-month-old change doesn't loiter on the dashboard forever.
export async function fetchTransitAdjustments(): Promise<TransitAdjustment | null> {
  // Cheap gate: skip the page scrape entirely if the RSS shows nothing recent.
  let hasRecent = false;
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(ADJUSTMENTS_FEED_URL);
    const cutoff = new Date(Date.now() - ADJUSTMENTS_RECENT_DAYS * 24 * 60 * 60 * 1000);
    hasRecent = (feed.items || []).some((item) => {
      const d = item.pubDate || item.isoDate;
      return d ? new Date(d) > cutoff : false;
    });
  } catch (e) {
    console.error('Failed to fetch transit adjustments RSS:', e);
    return null;
  }
  if (!hasRecent) return null;

  let html: string;
  try {
    const res = await fetch(ADJUSTMENTS_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    html = await res.text();
  } catch (e) {
    console.error('Failed to fetch transit adjustments page:', e);
    return null;
  }

  const root = parseHtml(html);
  // The page wraps each content block in a `.u-text-lighter` div. The one
  // we want has an `<h2>` whose text reads "<Date> Service Changes"
  // (literally — the upstream heading contains a <br> separator between
  // the date and "Service Changes", which collapses to a space on .text).
  for (const block of root.querySelectorAll('.u-text-lighter')) {
    const h2 = block.querySelector('h2');
    if (!h2) continue;
    const headingText = h2.text.replace(/\s+/g, ' ').trim();
    const m = headingText.match(/^(.+?)\s*Service Changes\s*$/i);
    if (!m) continue;
    const dateLabel = m[1].trim();

    // First <p> in the block is the intro sentence.
    const intro = block.querySelector('p')?.text.replace(/\s+/g, ' ').trim() ?? '';

    // First <ul> is the bullet summary of changes. Deeper headings
    // (Routing/Schedule/Bus stop changes) get their own sublists which
    // we deliberately skip — those route-by-route details live on the
    // source page; the dashboard just shows the highlight reel.
    const ul = block.querySelector('ul');
    const bullets: string[] = [];
    if (ul) {
      for (const li of ul.querySelectorAll('li')) {
        const t = li.text.replace(/\s+/g, ' ').trim();
        if (t) bullets.push(t);
      }
    }

    if (!intro && bullets.length === 0) continue; // empty block, keep looking

    return { dateLabel, intro, bullets, sourceUrl: ADJUSTMENTS_URL };
  }

  return null;
}
