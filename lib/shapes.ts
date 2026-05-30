// Polyline math used to "snap" each live vehicle to its trip's GTFS shape.
// Shapes are shipped to the client as Google-encoded polylines (the
// `shape_id -> string` map under public/transit/shapes.json). On load we
// decode each into a coordinate array + cumulative arc length, then for
// every vehicle sample we project its lat/lon onto the polyline to get an
// arc distance from the start of the route. The animation interpolates
// that scalar between samples and reads back a lat/lon from the polyline,
// so the marker glides along the actual road geometry instead of cutting
// diagonally across blocks.

export type LatLon = [number, number]; // [lat, lon]

export type DecodedShape = {
  coords: LatLon[];
  // Cumulative distance (meters) from coords[0] up through each vertex.
  // Length === coords.length; cumDist[0] = 0, cumDist[last] = total.
  cumDist: number[];
  total: number;
};

/** Standard Google polyline 5-decimal decoder. */
export function decodePolyline(s: string): LatLon[] {
  const out: LatLon[] = [];
  let i = 0, lat = 0, lon = 0;
  const n = s.length;
  while (i < n) {
    let result = 0, shift = 0, b: number;
    do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20 && i < n);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { b = s.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20 && i < n);
    lon += (result & 1) ? ~(result >> 1) : (result >> 1);
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

// Equirectangular distance between two lat/lon pairs. Sub-meter accurate at
// city scale and ~5x faster than haversine — fine for the 313k-edge
// projection loop we run on every poll.
function distMeters(a: LatLon, b: LatLon): number {
  const meanLat = ((a[0] + b[0]) / 2) * (Math.PI / 180);
  const dy = (b[0] - a[0]) * 111_320;
  const dx = (b[1] - a[1]) * 111_320 * Math.cos(meanLat);
  return Math.hypot(dx, dy);
}

export function buildShape(coords: LatLon[]): DecodedShape {
  const cumDist = new Array<number>(coords.length);
  cumDist[0] = 0;
  for (let i = 1; i < coords.length; i++) {
    cumDist[i] = cumDist[i - 1] + distMeters(coords[i - 1], coords[i]);
  }
  return { coords, cumDist, total: cumDist[cumDist.length - 1] || 0 };
}

/**
 * Find the arc-length distance (meters from start) that best matches a
 * raw lat/lon sample. Returns `null` when the point is implausibly far
 * from the shape — caller falls back to a straight-line LERP so a detour
 * (snow, construction) doesn't drag the marker across town.
 */
export function projectArc(shape: DecodedShape, lat: number, lon: number, maxOffsetMeters = 80): number | null {
  let bestDist2 = Infinity;
  let bestArc = 0;
  const meanLat0 = lat * (Math.PI / 180);
  const cosLat = Math.cos(meanLat0);
  // Project everything into a local planar space with the sample as the
  // origin. cosLat is treated as constant — a vehicle never strays more
  // than a few hundred meters from its sample, so the latitude term
  // hardly changes within the search neighborhood.
  const px = lon * cosLat;
  const py = lat;
  const coords = shape.coords;
  const cum = shape.cumDist;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const ax = a[1] * cosLat, ay = a[0];
    const bx = b[1] * cosLat, by = b[0];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const fx = ax + t * dx, fy = ay + t * dy;
    const ex = px - fx, ey = py - fy;
    const d2 = ex * ex + ey * ey;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      bestArc = cum[i] + t * (cum[i + 1] - cum[i]);
    }
  }
  // Convert squared planar distance back to meters.
  const bestMeters = Math.sqrt(bestDist2) * 111_320;
  if (bestMeters > maxOffsetMeters) return null;
  return bestArc;
}

/** Read a lat/lon back off the shape at the given arc distance. */
export function sampleAt(shape: DecodedShape, arc: number): LatLon {
  const coords = shape.coords;
  const cum = shape.cumDist;
  if (arc <= 0) return coords[0];
  if (arc >= shape.total) return coords[coords.length - 1];
  // Binary search for the segment containing `arc`.
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= arc) lo = mid; else hi = mid;
  }
  const segLen = cum[lo + 1] - cum[lo];
  const t = segLen > 0 ? (arc - cum[lo]) / segLen : 0;
  const a = coords[lo], b = coords[lo + 1];
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}
