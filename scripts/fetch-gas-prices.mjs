// Fetches Zone 1 regulated gas prices from NSERBT and appends to public/gas-prices.json.
// Zone 1 covers the Halifax metro area. Prices are set each Saturday by the NS regulator.
// Run weekly via GitHub Actions; keeps up to 52 weeks of history.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const OUT_PATH = resolve('public/gas-prices.json');
const PRICE_URL = 'https://nserbt.ca/mandates/gasoline-diesel-pricing/gasoline-prices-zone-map';
const MAX_HISTORY = 52;

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HalifaxCivicDashboard/1.0)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

function parseDate(html) {
  // Page shows "As at: Saturday, May 23, 2026" (possibly with HTML tags around the date)
  const patterns = [
    /As at[^:]*:\s*(?:<[^>]+>)?\s*([A-Za-z]+,\s*[A-Za-z]+\s+\d+,\s*\d{4})/i,
    /As at[^:]*:\s*([A-Za-z]+\s+\d+,\s*\d{4})/i,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      const d = new Date(m[1].trim());
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

function parseZone1Prices(html) {
  // Isolate Zone 1 section (everything before Zone 2 heading)
  const zone1Match = html.match(/Zone\s*1([\s\S]*?)(?=Zone\s*2|$)/i);
  if (!zone1Match) {
    console.error('Zone 1 section not found in page');
    return null;
  }
  const zone1 = zone1Match[1];

  // The page lists Min then Max for Regular Unleaded, then Min/Max for Diesel.
  // Extract all 3-digit-dot-1-digit prices (e.g. 187.9) in order.
  const nums = [...zone1.matchAll(/\b(\d{3}\.\d)\b/g)].map(m => parseFloat(m[1]));
  if (nums.length < 4) {
    console.error('Expected at least 4 price values in Zone 1, found:', nums);
    return null;
  }

  // [0] regular min, [1] regular max, [2] diesel min, [3] diesel max
  return { regular: nums[1], diesel: nums[3] };
}

async function main() {
  const html = await fetchHtml(PRICE_URL);

  const date = parseDate(html);
  if (!date) {
    console.error('Could not parse effective date');
    process.exit(1);
  }

  const prices = parseZone1Prices(html);
  if (!prices) {
    console.error('Could not parse Zone 1 prices');
    process.exit(1);
  }

  console.log(`Effective: ${date} | Regular: ${prices.regular} ¢/L | Diesel: ${prices.diesel} ¢/L`);

  let data = { history: [] };
  try {
    const raw = await readFile(OUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.history)) data = parsed;
  } catch {
    // First run — start fresh
  }

  if (data.history.some(e => e.date === date)) {
    console.log(`Already have data for ${date}, nothing to do`);
    return;
  }

  data.history.push({ date, regular: prices.regular, diesel: prices.diesel });
  data.history.sort((a, b) => a.date.localeCompare(b.date));
  if (data.history.length > MAX_HISTORY) data.history = data.history.slice(-MAX_HISTORY);
  data.updatedAt = new Date().toISOString();

  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log(`Saved ${data.history.length} entries to ${OUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
