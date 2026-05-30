// Downloads Halifax Transit GTFS static zip, extracts the two CSVs we need
// (stops.txt + routes.txt), and writes a minimal JSON shape under
// public/transit/. Runs in GitHub Actions weekly — runtime never touches
// the upstream zip, which keeps the live page free of cold-start latency.

import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';

const GTFS_URL = 'https://gtfs.halifax.ca/static/google_transit.zip';
const OUT_DIR = path.resolve('public', 'transit');

function parseCsv(text) {
  // GTFS CSV is well-behaved: comma-separated, optional double-quoted fields,
  // CRLF or LF. No embedded newlines in HRM's feed (verified empirically).
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        out.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    return row;
  });
}

async function main() {
  console.log(`Fetching ${GTFS_URL} ...`);
  const res = await fetch(GTFS_URL);
  if (!res.ok) throw new Error(`GTFS fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`Downloaded ${(buf.length / 1024 / 1024).toFixed(1)} MB`);

  const zip = new AdmZip(buf);
  const stopsTxt = zip.readAsText('stops.txt');
  const routesTxt = zip.readAsText('routes.txt');
  const tripsTxt = zip.readAsText('trips.txt');
  if (!stopsTxt || !routesTxt || !tripsTxt) throw new Error('zip missing stops/routes/trips');

  const stopsRaw = parseCsv(stopsTxt);
  const routesRaw = parseCsv(routesTxt);

  // Keep only physical stops (location_type 0 or empty). Parent stations
  // (type 1) and entrances (type 2) clutter the map without adding info.
  const stops = stopsRaw
    .filter((r) => !r.location_type || r.location_type === '0')
    .map((r) => ({
      id: r.stop_id,
      code: r.stop_code || undefined,
      name: r.stop_name,
      lat: Number(r.stop_lat),
      lon: Number(r.stop_lon),
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));

  const routes = routesRaw.map((r) => ({
    id: r.route_id,
    short: r.route_short_name || '',
    long: r.route_long_name || '',
    type: Number(r.route_type) || 3,
    color: r.route_color || undefined,
    text: r.route_text_color || undefined,
  }));

  // Halifax convention: "1 SPRING GARDEN TO BRIDGE TERM". Drop the leading
  // route number (already shown on the badge), normalize whitespace, title-
  // case for legibility, but keep agency abbreviations like "TERM" as-is.
  function cleanHeadsign(raw, routeShort) {
    if (!raw) return '';
    let s = raw.replace(/\s+/g, ' ').trim();
    if (routeShort) {
      const re = new RegExp(`^${routeShort.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s+`, 'i');
      s = s.replace(re, '');
    }
    return s.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
  }
  const routeShortById = new Map(routes.map((r) => [r.id, r.short]));
  const tripsRaw = parseCsv(tripsTxt);
  const trips = {};
  for (const t of tripsRaw) {
    const id = t.trip_id;
    if (!id) continue;
    const head = cleanHeadsign(t.trip_headsign, routeShortById.get(t.route_id));
    if (head) trips[id] = head;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(OUT_DIR, 'stops.json'),
    JSON.stringify({ updated: new Date().toISOString(), stops }),
  );
  await fs.writeFile(
    path.join(OUT_DIR, 'routes.json'),
    JSON.stringify({ updated: new Date().toISOString(), routes }),
  );
  await fs.writeFile(
    path.join(OUT_DIR, 'trips.json'),
    JSON.stringify({ updated: new Date().toISOString(), trips }),
  );

  console.log(`Wrote ${stops.length} stops, ${routes.length} routes, ${Object.keys(trips).length} trip headsigns`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
