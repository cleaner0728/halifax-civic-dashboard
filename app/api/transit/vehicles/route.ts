import { fetchVehicles } from '@/lib/fetchers/gtfs-rt';

// Edge cache for 10s; HRM's feed updates roughly every 15-30s, so polling
// faster than this just burns bandwidth without surfacing new positions.
export const revalidate = 0;

export async function GET() {
  try {
    const vehicles = await fetchVehicles();
    return new Response(JSON.stringify({ updated: Date.now(), vehicles }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      },
    });
  } catch (e) {
    console.error('vehicles route failed:', e);
    return new Response(JSON.stringify({ updated: Date.now(), vehicles: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
