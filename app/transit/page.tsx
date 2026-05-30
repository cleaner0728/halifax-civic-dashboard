import fs from 'node:fs/promises';
import path from 'node:path';
import Link from 'next/link';
import TransitMap from '@/components/TransitMapLoader';

// Load the static GTFS shaped at build time. fs.readFile is faster than an
// HTTP self-fetch and works the same in dev, build, and runtime.
async function loadStatic() {
  const dir = path.join(process.cwd(), 'public', 'transit');
  try {
    const [stopsRaw, routesRaw] = await Promise.all([
      fs.readFile(path.join(dir, 'stops.json'), 'utf8'),
      fs.readFile(path.join(dir, 'routes.json'), 'utf8'),
    ]);
    return {
      stops: JSON.parse(stopsRaw).stops as Array<{
        id: string; code?: string; name: string; lat: number; lon: number;
      }>,
      routes: JSON.parse(routesRaw).routes as Array<{
        id: string; short: string; long: string; color?: string; text?: string;
      }>,
    };
  } catch {
    return { stops: [], routes: [] };
  }
}

export const metadata = { title: 'Halifax Transit — Live Map' };

export default async function TransitPage() {
  const { stops, routes } = await loadStatic();
  return (
    <main className="fixed inset-0 flex flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 px-3 py-2.5 bg-card/95 backdrop-blur border-b border-border z-10 shadow-sm">
        <Link
          href="/"
          className="text-sm text-foreground/60 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
        >
          ← Dashboard
        </Link>
        <h1 className="text-sm font-semibold text-foreground">
          Halifax Transit <span className="text-sky-600 dark:text-sky-400">· Live</span>
        </h1>
        <span className="ml-auto text-[11px] text-foreground/50">
          {stops.length} stops · {routes.length} routes
        </span>
      </header>
      <div className="flex-1 relative">
        <TransitMap stops={stops} routes={routes} />
      </div>
    </main>
  );
}
