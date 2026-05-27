'use client';

import { useState } from 'react';

// Windy embed: ~1-2 MB of JS + tiles. Only mount the iframe after the
// user opens the section; keep it mounted after that so re-opening is
// instant and the user's layer/zoom choices survive.
//
// data-no-tab-swipe is required: this app's bottom-tab swiper would
// otherwise hijack horizontal drag inside the map (same fix we shipped
// for the tides SVG and hourly scroller).

const HFX_LAT = 44.6488;
const HFX_LON = -63.5752;
const DEFAULT_ZOOM = 8;

type Overlay = 'wind' | 'waves' | 'rain' | 'temp' | 'clouds';

const OVERLAYS: { id: Overlay; label: string }[] = [
  { id: 'wind', label: 'Wind' },
  { id: 'waves', label: 'Waves' },
  { id: 'rain', label: 'Rain' },
  { id: 'temp', label: 'Temp' },
  { id: 'clouds', label: 'Clouds' },
];

function buildSrc(overlay: Overlay): string {
  const params = new URLSearchParams({
    lat: String(HFX_LAT),
    lon: String(HFX_LON),
    detailLat: String(HFX_LAT),
    detailLon: String(HFX_LON),
    zoom: String(DEFAULT_ZOOM),
    level: 'surface',
    overlay,
    product: 'ecmwf',
    menu: '',
    message: '',
    marker: '',
    calendar: 'now',
    pressure: '',
    type: 'map',
    location: 'coordinates',
    metricWind: 'km/h',
    metricTemp: '°C',
    radarRange: '-1',
  });
  return `https://embed.windy.com/embed2.html?${params.toString()}`;
}

export default function WindyMapBlock() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>('wind');

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !mounted) setMounted(true);
  }

  return (
    <section className="mt-8">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 mb-3 px-1 cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl" aria-hidden>🌬️</span>
          <h2 className="text-lg font-bold text-foreground truncate">Marine & Wind Map</h2>
          <span className="text-xs text-foreground/40 truncate">· windy.com</span>
        </div>
        <svg
          className={`w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-2">
          <div data-no-tab-swipe className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-1">
            {OVERLAYS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setOverlay(o.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  overlay === o.id
                    ? 'bg-foreground text-background'
                    : 'bg-foreground/10 text-foreground/70 hover:bg-foreground/15'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div
            data-no-tab-swipe
            className="relative rounded-xl overflow-hidden border border-foreground/10"
            style={{ aspectRatio: '4 / 3' }}
          >
            {mounted && (
              <iframe
                key={overlay}
                src={buildSrc(overlay)}
                title="Windy weather map for Halifax"
                loading="lazy"
                allow="fullscreen"
                className="absolute inset-0 w-full h-full"
              />
            )}
          </div>

          <a
            href={`https://www.windy.com/?${overlay},${HFX_LAT},${HFX_LON},${DEFAULT_ZOOM}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-foreground/50 hover:text-foreground/80 px-1"
          >
            open on windy.com ↗
          </a>
        </div>
      )}
    </section>
  );
}
