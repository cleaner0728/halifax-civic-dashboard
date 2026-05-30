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
  const shapesTxt = zip.readAsText('shapes.txt');
  if (!stopsTxt || !routesTxt || !tripsTxt || !shapesTxt) {
    throw new Error('zip missing stops/routes/trips/shapes');
  }

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
  // Mapping the client needs to snap each vehicle to its route's geometry.
  // Kept tiny by only emitting the trip_id => shape_id pair (no headsigns,
  // no route ids — server-only consumers read trips.json instead).
  const tripShape = {};
  for (const t of tripsRaw) {
    const id = t.trip_id;
    if (!id) continue;
    const head = cleanHeadsign(t.trip_headsign, routeShortById.get(t.route_id));
    if (head) trips[id] = head;
    if (t.shape_id) tripShape[id] = t.shape_id;
  }

  // shapes.txt is one row per (shape, point, sequence). Re-group into
  // ordered [[lon, lat], ...] polylines, then Google-polyline-encode each
  // to ship efficiently. Encoded shapes for Halifax: ~150 KB total
  // (vs. ~12 MB raw CSV).
  const shapesRaw = parseCsv(shapesTxt);
  const shapeBuckets = new Map();
  for (const r of shapesRaw) {
    const id = r.shape_id;
    if (!id) continue;
    const lat = Number(r.shape_pt_lat);
    const lon = Number(r.shape_pt_lon);
    const seq = Number(r.shape_pt_sequence);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(seq)) continue;
    let bucket = shapeBuckets.get(id);
    if (!bucket) { bucket = []; shapeBuckets.set(id, bucket); }
    bucket.push([seq, lat, lon]);
  }
  function encodePolyline(latLonPairs) {
    // Standard Google polyline algorithm: signed varints in base-64 ASCII,
    // each value delta-encoded against the previous point.
    let out = '';
    let prevLat = 0, prevLon = 0;
    const encVal = (v) => {
      let n = v < 0 ? ~(v << 1) : (v << 1);
      let s = '';
      while (n >= 0x20) {
        s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
        n >>>= 5;
      }
      s += String.fromCharCode(n + 63);
      return s;
    };
    for (const [lat, lon] of latLonPairs) {
      const latE5 = Math.round(lat * 1e5);
      const lonE5 = Math.round(lon * 1e5);
      out += encVal(latE5 - prevLat);
      out += encVal(lonE5 - prevLon);
      prevLat = latE5; prevLon = lonE5;
    }
    return out;
  }
  const shapes = {};
  for (const [id, pts] of shapeBuckets) {
    pts.sort((a, b) => a[0] - b[0]);
    shapes[id] = encodePolyline(pts.map(([, lat, lon]) => [lat, lon]));
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
  await fs.writeFile(
    path.join(OUT_DIR, 'shapes.json'),
    JSON.stringify({ updated: new Date().toISOString(), shapes, tripShape }),
  );

  const shapesJsonSize = JSON.stringify({ shapes, tripShape }).length;
  console.log(
    `Wrote ${stops.length} stops, ${routes.length} routes, ` +
    `${Object.keys(trips).length} trip headsigns, ` +
    `${Object.keys(shapes).length} shapes (${(shapesJsonSize / 1024).toFixed(0)} KB)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
