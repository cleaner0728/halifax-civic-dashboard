// Nova Scotia burn-restriction status for Halifax County, scraped from
// novascotia.ca/burnsafe (a single static HTML table). The page categorises
// each county into one of three states via a CSS class on the <td>.

import { parse as parseHtml } from 'node-html-parser';

export type BurnStatus = {
  level: 'allowed' | 'restricted' | 'no-burn';
  text: string; // human-readable detail, e.g. "Burning is only allowed between 7:00 pm and 8:00 am"
};

const STATUS_CLASS_MAP: Record<string, BurnStatus['level']> = {
  'status-allowed': 'allowed',
  'status-burn': 'allowed',
  'status-restricted': 'restricted',
  'status-no-burn': 'no-burn',
};

export async function fetchBurnStatus(): Promise<BurnStatus | null> {
  try {
    const res = await fetch('https://novascotia.ca/burnsafe/', { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const html = await res.text();
    const root = parseHtml(html);
    const row = root.querySelector('#Halifax-County');
    if (!row) return null;
    const td = row.querySelector('td');
    if (!td) return null;
    const classes = (td.getAttribute('class') ?? '').split(/\s+/);
    const matched = classes.find((c) => c in STATUS_CLASS_MAP);
    const level = matched ? STATUS_CLASS_MAP[matched] : null;
    if (!level) return null;
    const text = td.querySelector('p')?.text.trim() ?? '';
    return { level, text };
  } catch (e) {
    console.error('Failed to fetch burn status:', e);
    return null;
  }
}
