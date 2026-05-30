'use client';

// Thin client wrapper. maplibre-gl touches `window` at module load, so we
// can't let it ride a server render. Wrapping the real map in next/dynamic
// from a client component is the only way ssr:false is allowed in Next 16.
import dynamic from 'next/dynamic';

type Stop = { id: string; code?: string; name: string; lat: number; lon: number };
type Route = { id: string; short: string; long: string; color?: string; text?: string };

const TransitMap = dynamic(() => import('./TransitMap'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-foreground/55 text-sm bg-background">
      Loading map…
    </div>
  ),
});

export default function TransitMapLoader(props: { stops: Stop[]; routes: Route[] }) {
  return <TransitMap {...props} />;
}
