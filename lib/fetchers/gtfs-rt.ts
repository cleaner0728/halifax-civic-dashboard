// Server-side reader for Halifax Transit GTFS-Realtime feeds. Both feeds
// are protobuf, served by Halifax IIS. We parse on the server, cache for a
// few seconds at the edge, and ship JSON to the browser — no protobuf
// runtime in the client bundle.

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const { transit_realtime } = GtfsRealtimeBindings;

const VEHICLES_URL = 'https://gtfs.halifax.ca/realtime/Vehicle/VehiclePositions.pb';
const TRIPS_URL = 'https://gtfs.halifax.ca/realtime/TripUpdate/TripUpdates.pb';

async function fetchFeedRaw(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HalifaxCivicDashboard/1.0' },
    signal: AbortSignal.timeout(8_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GTFS-RT ${url} -> ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return transit_realtime.FeedMessage.decode(buf);
}

// Per-feed in-process cache. Vercel re-uses warm containers across
// invocations, so multiple requests with different `stops=` filters in the
// same ~8s window share a single fetch + decode instead of each doing
// their own 1-3 MB protobuf parse. Cache TTL stays under the edge
// Cache-Control window so we never serve data older than the edge would.
type FeedEntry = { ts: number; data: ReturnType<typeof transit_realtime.FeedMessage.decode> };
const FEED_TTL_MS = 8_000;
const feedCache = new Map<string, FeedEntry>();
const feedInflight = new Map<string, Promise<FeedEntry['data']>>();

async function fetchFeed(url: string) {
  const now = Date.now();
  const cached = feedCache.get(url);
  if (cached && now - cached.ts < FEED_TTL_MS) return cached.data;

  // Coalesce concurrent callers onto a single in-flight request.
  const pending = feedInflight.get(url);
  if (pending) return pending;

  const p = fetchFeedRaw(url)
    .then((data) => {
      feedCache.set(url, { ts: Date.now(), data });
      return data;
    })
    .finally(() => { feedInflight.delete(url); });
  feedInflight.set(url, p);
  return p;
}

export type RtVehicle = {
  id: string;            // vehicle id (e.g. "1234")
  routeId?: string;
  tripId?: string;
  lat: number;
  lon: number;
  bearing?: number;      // 0-360
  speed?: number;        // m/s
  ts?: number;           // unix seconds
  stopId?: string;       // current stop reference
  label?: string;        // vehicle label as shown on bus
};

export async function fetchVehicles(): Promise<RtVehicle[]> {
  const feed = await fetchFeed(VEHICLES_URL);
  const out: RtVehicle[] = [];
  for (const entity of feed.entity ?? []) {
    const v = entity.vehicle;
    const pos = v?.position;
    if (!v || !pos || pos.latitude == null || pos.longitude == null) continue;
    out.push({
      id: entity.id ?? v.vehicle?.id ?? '',
      routeId: v.trip?.routeId ?? undefined,
      tripId: v.trip?.tripId ?? undefined,
      lat: pos.latitude,
      lon: pos.longitude,
      bearing: pos.bearing ?? undefined,
      speed: pos.speed ?? undefined,
      ts: typeof v.timestamp === 'number' ? v.timestamp : Number(v.timestamp ?? 0) || undefined,
      stopId: v.stopId ?? undefined,
      label: v.vehicle?.label ?? undefined,
    });
  }
  return out;
}

export type RtArrival = {
  routeId?: string;
  tripId?: string;
  stopId: string;
  // Absolute unix seconds (preferred) for the predicted arrival or
  // departure at this stop, whichever the upstream provided.
  time: number;
  delay?: number;        // seconds, signed (negative = early)
  headsign?: string;
};

// Returns predicted arrivals grouped by stopId for the whole network.
// Filtering down to a single stop on the client is trivial; doing it
// server-side per request would re-parse the same 1-3MB feed every call.
export async function fetchArrivalsByStop(): Promise<Map<string, RtArrival[]>> {
  const feed = await fetchFeed(TRIPS_URL);
  const byStop = new Map<string, RtArrival[]>();
  for (const entity of feed.entity ?? []) {
    const tu = entity.tripUpdate;
    if (!tu) continue;
    const routeId = tu.trip?.routeId ?? undefined;
    const tripId = tu.trip?.tripId ?? undefined;
    for (const stu of tu.stopTimeUpdate ?? []) {
      const stopId = stu.stopId;
      if (!stopId) continue;
      // Prefer arrival, fall back to departure. Both have .time (unix s).
      const ev = stu.arrival ?? stu.departure;
      const tRaw = ev?.time;
      const t = typeof tRaw === 'number' ? tRaw : Number(tRaw ?? 0);
      if (!t) continue;
      // Upstream sometimes emits a ghost entry with no route or trip id
      // alongside the real prediction — drop those so the UI doesn't show
      // blank route pills.
      if (!routeId && !tripId) continue;
      const arr: RtArrival = {
        routeId,
        tripId,
        stopId,
        time: t,
        delay: ev?.delay ?? undefined,
      };
      const bucket = byStop.get(stopId);
      if (bucket) bucket.push(arr);
      else byStop.set(stopId, [arr]);
    }
  }
  // Sort each bucket ascending by time so the client can take .slice(0, N).
  for (const list of byStop.values()) list.sort((a, b) => a.time - b.time);
  return byStop;
}
