import { inflateRaw } from 'node:zlib';
import { promisify } from 'node:util';

const inflateRawAsync = promisify(inflateRaw);

// Stats Canada table 18-10-0245-01: Monthly average retail prices for selected products
const CSV_URL = 'https://www150.statcan.gc.ca/n1/tbl/csv/18100245-eng.zip';
const MONTHS = 24;

// 1 lb = 0.453592 kg, so $/kg × 0.453592 = $/lb
const KG_TO_LB = 0.453592;

const WANTED = [
  { key: 'beef',     label: 'Ground Beef',    unit: '$/lb',   match: 'Ground beef, per kilogram',    multiplier: KG_TO_LB },
  { key: 'chicken',  label: 'Chicken Breast', unit: '$/lb',   match: 'Chicken breasts, per kilogram', multiplier: KG_TO_LB },
  { key: 'pork',     label: 'Pork Loin',      unit: '$/lb',   match: 'Pork loin cuts, per kilogram',  multiplier: KG_TO_LB },
  { key: 'eggs',     label: 'Eggs',           unit: '$/doz',  match: 'Eggs, 1 dozen',                 multiplier: 1 },
  { key: 'milk',     label: 'Milk (2L)',      unit: '$/2L',   match: 'Milk, 2 litres',                multiplier: 1 },
  { key: 'bread',    label: 'White Bread',    unit: '$/loaf', match: 'White bread, 675 grams',        multiplier: 1 },
  { key: 'potatoes', label: 'Potatoes',       unit: '$/lb',   match: 'Potatoes, per kilogram',        multiplier: KG_TO_LB },
  { key: 'tomatoes', label: 'Tomatoes',       unit: '$/lb',   match: 'Tomatoes, per kilogram',        multiplier: KG_TO_LB },
];

// Lookup from exact product name → WANTED entry
const matchIndex = new Map(WANTED.map(w => [w.match.toLowerCase(), w]));

export type GroceryDataPoint = { date: string; value: number };

export type GroceryItem = {
  key: string;
  label: string;
  unit: string;
  history: GroceryDataPoint[];
};

export type GroceryPriceData = { items: GroceryItem[] };

// Extract the largest file from a ZIP buffer using Node.js built-in zlib
async function extractLargestFileFromZip(buffer: Buffer): Promise<Buffer> {
  const EOCD_SIG = 0x06054b50;
  const CD_SIG   = 0x02014b50;
  const LFH_SIG  = 0x04034b50;

  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('EOCD not found');

  const cdOffset  = buffer.readUInt32LE(eocdOffset + 16);
  const cdEntries = buffer.readUInt16LE(eocdOffset + 8);

  let pos = cdOffset;
  let bestOffset = -1;
  let bestSize   = -1;
  let bestMethod = 0;

  for (let e = 0; e < cdEntries; e++) {
    if (buffer.readUInt32LE(pos) !== CD_SIG) break;
    const method         = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const filenameLen    = buffer.readUInt16LE(pos + 28);
    const extraLen       = buffer.readUInt16LE(pos + 30);
    const commentLen     = buffer.readUInt16LE(pos + 32);
    const localOffset    = buffer.readUInt32LE(pos + 42);
    if (compressedSize > bestSize) {
      bestSize   = compressedSize;
      bestOffset = localOffset;
      bestMethod = method;
    }
    pos += 46 + filenameLen + extraLen + commentLen;
  }

  if (bestOffset === -1) throw new Error('No ZIP entries found');
  if (buffer.readUInt32LE(bestOffset) !== LFH_SIG) throw new Error('Bad local file header');

  const fnLen    = buffer.readUInt16LE(bestOffset + 26);
  const exLen    = buffer.readUInt16LE(bestOffset + 28);
  const dataPos  = bestOffset + 30 + fnLen + exLen;
  const payload  = buffer.slice(dataPos, dataPos + bestSize);

  return bestMethod === 8 ? inflateRawAsync(payload) : payload;
}

export async function fetchGroceryPrices(): Promise<GroceryPriceData> {
  try {
    const res = await fetch(CSV_URL, { next: { revalidate: 86400 } });
    if (!res.ok) return { items: [] };

    const zip = Buffer.from(await res.arrayBuffer());
    const rawCsv = await extractLargestFileFromZip(zip);
    // Strip BOM if present
    const csvText = rawCsv[0] === 0xef && rawCsv[1] === 0xbb && rawCsv[2] === 0xbf
      ? rawCsv.slice(3).toString('utf8')
      : rawCsv.toString('utf8');

    // All fields are double-quoted; split each row on `","` for speed
    // Header: REF_DATE(0) GEO(1) DGUID(2) Products(3) ... VALUE(10)
    const IDX_DATE    = 0;
    const IDX_GEO     = 1;
    const IDX_PRODUCT = 3;
    const IDX_VALUE   = 10;

    // Cutoff date: 24 months ago
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - MONTHS);
    const cutoff = cutoffDate.toISOString().slice(0, 7); // "YYYY-MM"

    // Accumulate data: key → date → value
    const acc = new Map<string, Map<string, number>>(WANTED.map(w => [w.key, new Map()]));

    const lines = csvText.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.length < 20) continue;

      // Quick geo filter before full parse (cheap string search)
      if (!line.includes('Nova Scotia')) continue;

      // Strip surrounding quotes and split on `","`
      const stripped = line.startsWith('"') ? line.slice(1, line.endsWith('\r"') ? -2 : line.endsWith('"') ? -1 : line.length) : line;
      const cols = stripped.split('","');

      const date    = cols[IDX_DATE]?.trim();
      const geo     = cols[IDX_GEO]?.trim();
      const product = cols[IDX_PRODUCT]?.trim().toLowerCase();
      const rawVal  = cols[IDX_VALUE]?.trim();

      if (!date || !geo || !product || !rawVal) continue;
      if (date < cutoff) continue;
      if (!/nova scotia/i.test(geo)) continue;

      const entry = matchIndex.get(product);
      if (!entry) continue;

      const value = parseFloat(rawVal);
      if (!isFinite(value) || value <= 0) continue;

      acc.get(entry.key)!.set(date, value * entry.multiplier);
    }

    const items: GroceryItem[] = WANTED.map(w => ({
      key: w.key,
      label: w.label,
      unit: w.unit,
      history: Array.from(acc.get(w.key)!.entries())
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    })).filter(item => item.history.length > 0);

    return { items };
  } catch {
    return { items: [] };
  }
}
