// One-time backfill: fetches recent NSERBT price PDFs, extracts Zone 1 prices,
// and prepends them to public/gas-prices.json.
// Requires pdftotext (poppler-utils) to be installed.
// Run via GitHub Actions workflow: .github/workflows/backfill-gas-prices.yml

import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const execAsync = promisify(exec);
const OUT_PATH = resolve('public/gas-prices.json');
const MAX_HISTORY = 52;

// From NSERBT historical-prices page — weekly effective dates and PDF numbers.
// Interrupter entries (mid-week adjustments) are excluded; only Saturday prices kept.
// PDF numbers before April 2026 are estimated (~2 per week); the script skips any
// that return 404 so wrong guesses are safe.
const BACKFILL_PDFS = [
  { date: '2026-05-15', url: 'https://nserbt.ca/sites/default/files/gasprice_327.pdf' },
  { date: '2026-05-08', url: 'https://nserbt.ca/sites/default/files/gasprice_326.pdf' },
  { date: '2026-05-01', url: 'https://nserbt.ca/sites/default/files/gasprice_325.pdf' },
  { date: '2026-04-24', url: 'https://nserbt.ca/sites/default/files/gasprice_323.pdf' },
  { date: '2026-04-17', url: 'https://nserbt.ca/sites/default/files/gasprice_321.pdf' },
  { date: '2026-04-10', url: 'https://nserbt.ca/sites/default/files/gasprice_319.pdf' },
  { date: '2026-04-03', url: 'https://nserbt.ca/sites/default/files/gasprice_317.pdf' },
  { date: '2026-03-27', url: 'https://nserbt.ca/sites/default/files/gasprice_315.pdf' },
  { date: '2026-03-20', url: 'https://nserbt.ca/sites/default/files/gasprice_313.pdf' },
  { date: '2026-03-13', url: 'https://nserbt.ca/sites/default/files/gasprice_311.pdf' },
  { date: '2026-03-06', url: 'https://nserbt.ca/sites/default/files/gasprice_309.pdf' },
  { date: '2026-02-27', url: 'https://nserbt.ca/sites/default/files/gasprice_307.pdf' },
  { date: '2026-02-20', url: 'https://nserbt.ca/sites/default/files/gasprice_305.pdf' },
  { date: '2026-02-13', url: 'https://nserbt.ca/sites/default/files/gasprice_303.pdf' },
  { date: '2026-02-06', url: 'https://nserbt.ca/sites/default/files/gasprice_301.pdf' },
  { date: '2026-01-30', url: 'https://nserbt.ca/sites/default/files/gasprice_299.pdf' },
  { date: '2026-01-23', url: 'https://nserbt.ca/sites/default/files/gasprice_297.pdf' },
  { date: '2026-01-16', url: 'https://nserbt.ca/sites/default/files/gasprice_295.pdf' },
  { date: '2026-01-09', url: 'https://nserbt.ca/sites/default/files/gasprice_293.pdf' },
  { date: '2026-01-02', url: 'https://nserbt.ca/sites/default/files/gasprice_291.pdf' },
  { date: '2025-12-26', url: 'https://nserbt.ca/sites/default/files/gasprice_289.pdf' },
  { date: '2025-12-19', url: 'https://nserbt.ca/sites/default/files/gasprice_287.pdf' },
  { date: '2025-12-12', url: 'https://nserbt.ca/sites/default/files/gasprice_285.pdf' },
  { date: '2025-12-05', url: 'https://nserbt.ca/sites/default/files/gasprice_283.pdf' },
  { date: '2025-11-28', url: 'https://nserbt.ca/sites/default/files/gasprice_281.pdf' },
  { date: '2025-11-21', url: 'https://nserbt.ca/sites/default/files/gasprice_279.pdf' },
  { date: '2025-11-14', url: 'https://nserbt.ca/sites/default/files/gasprice_277.pdf' },
  { date: '2025-11-07', url: 'https://nserbt.ca/sites/default/files/gasprice_275.pdf' },
];

async function downloadPdf(url, destPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HalifaxCivicDashboard/1.0)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

function parseZone1FromText(text) {
  // PDF text can have varied whitespace; normalise first.
  const flat = text.replace(/\s+/g, ' ');

  // Isolate Zone 1 block (up to Zone 2 header)
  const zone1 = flat.match(/Zone\s*1([\s\S]*?)(?=Zone\s*2|$)/i)?.[1];
  if (!zone1) return null;

  // Collect all 3-digit.1-digit numbers (e.g. 187.9, 220.4)
  const nums = [...zone1.matchAll(/\b(\d{3}\.\d)\b/g)].map(m => parseFloat(m[1]));
  if (nums.length < 4) return null;

  // Layout: regularMin, regularMax, dieselMin, dieselMax
  return { regular: nums[1], diesel: nums[3] };
}

async function processPdf(entry, tmpDir) {
  const pdfPath = join(tmpDir, `gas_${entry.date}.pdf`);
  const txtPath = join(tmpDir, `gas_${entry.date}.txt`);

  try {
    await downloadPdf(entry.url, pdfPath);
    await execAsync(`pdftotext -layout "${pdfPath}" "${txtPath}"`);
    const text = await readFile(txtPath, 'utf8');
    const prices = parseZone1FromText(text);
    if (!prices) {
      console.warn(`  ⚠ Could not parse Zone 1 prices from ${entry.date}`);
      return null;
    }
    console.log(`  ✓ ${entry.date}: regular ${prices.regular} ¢/L, diesel ${prices.diesel} ¢/L`);
    return { date: entry.date, ...prices };
  } catch (err) {
    console.warn(`  ⚠ Failed ${entry.date}: ${err.message}`);
    return null;
  }
}

async function main() {
  // Load existing data
  let data = { history: [] };
  try {
    const raw = await readFile(OUT_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.history)) data = parsed;
  } catch {
    // No file yet
  }

  const existingDates = new Set(data.history.map(e => e.date));
  const toFetch = BACKFILL_PDFS.filter(e => !existingDates.has(e.date));

  if (toFetch.length === 0) {
    console.log('All backfill dates already present — nothing to do.');
    return;
  }

  console.log(`Backfilling ${toFetch.length} weeks...`);
  const tmpDir = await mkdtemp(join(tmpdir(), 'gas-backfill-'));

  try {
    const results = [];
    for (const entry of toFetch) {
      const result = await processPdf(entry, tmpDir);
      if (result) results.push(result);
    }

    if (results.length === 0) {
      console.error('No data extracted — exiting without changes.');
      process.exit(1);
    }

    data.history.push(...results);
    data.history.sort((a, b) => a.date.localeCompare(b.date));
    if (data.history.length > MAX_HISTORY) data.history = data.history.slice(-MAX_HISTORY);
    data.updatedAt = new Date().toISOString();

    await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
    console.log(`Done — ${data.history.length} total entries saved.`);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
