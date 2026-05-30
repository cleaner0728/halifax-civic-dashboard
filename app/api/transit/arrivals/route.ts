import fs from 'node:fs/promises';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { fetchArrivalsByStop } from '@/lib/fetchers/gtfs-rt';

// Lazily load the trip_id → headsign map once per process and reuse it.
// trips.json is ~350KB; parsing it on every request would dominate latency.
let tripsCache: Record<string, string> | null = null;
let tripsLoading: Promise<Record<string, string>> | null = null;
async function loadTrips(): Promise<Record<string, string>> {
  if (tripsCache) return tripsCache;
  if (tripsLoading) return tripsLoading;
  tripsLoading = (async () => {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), 'public', 'transit', 'trips.json'), 'utf8');
      const parsed = JSON.parse(raw) as { trips?: Record<string, string> };
      tripsCache = parsed.trips ?? {};
    } catch {
      tripsCache = {};
    }
    return tripsCache!;
  })();
  return tripsLoading;
}

// ?stops=1234,5678,...  -> { stopId: RtArrival[] }
// Without a `stops` filter we'd ship the entire predicted-arrival graph
// for the network, which is tens of thousands of entries. Require the
// client to name the stops it cares about.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('stops') ?? '';
  const wanted = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  if (wanted.size === 0) {
    return new Response(JSON.stringify({ error: 'missing stops' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const [all, trips] = await Promise.all([fetchArrivalsByStop(), loadTrips()]);
    const out: Record<string, unknown[]> = {};
    const now = Math.floor(Date.now() / 1000);
    for (const stopId of wanted) {
      const list = all.get(stopId) ?? [];
      out[stopId] = list
        .filter((a) => a.time > now - 30)
        .slice(0, 8)
        .map((a) => ({
          ...a,
          // Inject the rider-facing destination ("Spring Garden To Bridge
          // Term"). Empty when the trip isn't in the static schedule —
          // e.g. an unscheduled service — UI falls back gracefully.
          headsign: (a.tripId && trips[a.tripId]) || undefined,
        }));
    }
    return new Response(JSON.stringify({ updated: Date.now(), arrivals: out }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      },
    });
  } catch (e) {
    console.error('arrivals route failed:', e);
    return new Response(JSON.stringify({ updated: Date.now(), arrivals: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
