'use client';

import { useState } from 'react';
import { HFX_TZ } from '@/lib/date';
import type { BuoyObservation } from '@/lib/fetchers/buoy';
import type { MarineForecast } from '@/lib/fetchers/marine-forecast';

// Combined marine block: Windy interactive map + live buoy observations
// + ECCC marine forecast text + active marine warnings, all in one
// collapsible section.
//
// Design rule (sports-context safety): NO scoring, NO go/no-go labels,
// NO color-coded "good/bad" indicators. Display raw observed values +
// official text + timestamps and let the user judge.
//
// Windy iframe is lazy-mounted on first open (~1-2 MB of JS + tiles).
// data-no-tab-swipe required on the map and any horizontally scrollable
// child so the app's bottom-tab swiper doesn't hijack drag gestures.

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

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Beaufort scale boundaries from km/h. Source: WMO/Met Office.
const BEAUFORT = [
  { force: 0, upTo: 1, name: 'Calm' },
  { force: 1, upTo: 5, name: 'Light air' },
  { force: 2, upTo: 11, name: 'Light breeze' },
  { force: 3, upTo: 19, name: 'Gentle breeze' },
  { force: 4, upTo: 28, name: 'Moderate breeze' },
  { force: 5, upTo: 38, name: 'Fresh breeze' },
  { force: 6, upTo: 49, name: 'Strong breeze' },
  { force: 7, upTo: 61, name: 'Near gale' },
  { force: 8, upTo: 74, name: 'Gale' },
  { force: 9, upTo: 88, name: 'Strong gale' },
  { force: 10, upTo: 102, name: 'Storm' },
  { force: 11, upTo: 117, name: 'Violent storm' },
  { force: 12, upTo: Infinity, name: 'Hurricane' },
];

function beaufort(kmh: number): { force: number; name: string } {
  return BEAUFORT.find((b) => kmh < b.upTo) ?? BEAUFORT[BEAUFORT.length - 1];
}

function formatObservedAt(iso: string): { label: string; ageMs: number } {
  const ms = new Date(iso).getTime();
  return {
    label: new Date(iso).toLocaleString('en-US', {
      timeZone: HFX_TZ,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
    }),
    ageMs: Date.now() - ms,
  };
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-foreground/50">{label}</p>
      <p className="text-base font-semibold mt-0.5 font-mono tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-foreground/50 mt-0.5">{sub}</p>}
    </div>
  );
}

type Props = {
  buoy: BuoyObservation | null;
  marineForecast: MarineForecast | null;
  headless?: boolean;
};

export default function WindyMapBlock({ buoy, marineForecast, headless = false }: Props) {
  const [open, setOpen] = useState(headless);
  const [mounted, setMounted] = useState(headless);
  const [overlay, setOverlay] = useState<Overlay>('wind');

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !mounted) setMounted(true);
  }

  const fresh = buoy ? formatObservedAt(buoy.observedAt) : null;
  // Two-hour rule: stale buoy data dims so it's obviously not "now",
  // but we still show it (offline buoy is itself a useful signal).
  const stale = fresh ? fresh.ageMs > 2 * 60 * 60 * 1000 : false;
  const windB = buoy?.windSpeed != null ? beaufort(buoy.windSpeed) : null;
  const forecastIssued = marineForecast?.issuedAt
    ? new Date(marineForecast.issuedAt).toLocaleString('en-US', {
        timeZone: HFX_TZ,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        month: 'short',
        day: 'numeric',
      })
    : '';

  const body = (
    <div className="space-y-3">
      {marineForecast && marineForecast.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300 mb-1">
            Marine warnings in effect
          </p>
          <ul className="space-y-0.5">
            {marineForecast.warnings.map((w, i) => (
              <li key={i} className="text-sm font-semibold text-foreground">
                {w.name}
                <span className="text-xs font-normal text-foreground/60 ml-2">· {w.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-4">
        {!buoy ? (
          <p className="text-sm text-foreground/60">
            Buoy data unavailable. The SmartAtlantic Herring Cove buoy may be offline.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
              <p className="text-[11px] uppercase tracking-widest text-foreground/50">Observed</p>
              <p className={`text-xs font-mono ${stale ? 'text-amber-700 dark:text-amber-300' : 'text-foreground/60'}`}>
                {fresh!.label}
                {stale && ' · stale'}
              </p>
            </div>
            <div className={`grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 ${stale ? 'opacity-60' : ''}`}>
              <Field
                label="Wind"
                value={
                  buoy.windSpeed === null
                    ? '—'
                    : `${buoy.windDirection !== null ? degreesToCompass(buoy.windDirection) + ' ' : ''}${buoy.windSpeed} km/h`
                }
                sub={
                  [
                    buoy.windGust !== null ? `gust ${buoy.windGust} km/h` : null,
                    windB ? `F${windB.force} ${windB.name}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
              />
              <Field
                label="Waves (sig.)"
                value={buoy.waveHeightSig === null ? '—' : `${buoy.waveHeightSig.toFixed(1)} m`}
                sub={buoy.waveHeightMax !== null ? `max ${buoy.waveHeightMax.toFixed(1)} m` : undefined}
              />
              <Field
                label="Wave period"
                value={buoy.wavePeriodMax === null ? '—' : `${buoy.wavePeriodMax.toFixed(1)} s`}
                sub={
                  [
                    buoy.waveDirection !== null ? `from ${degreesToCompass(buoy.waveDirection)}` : null,
                    buoy.waveSpread !== null ? `spread ${Math.round(buoy.waveSpread)}°` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
              />
              <Field
                label="Water temp"
                value={buoy.waterTemp === null ? '—' : `${buoy.waterTemp.toFixed(1)} °C`}
              />
              <Field
                label="Surface current"
                value={buoy.currentSpeed === null ? '—' : `${buoy.currentSpeed.toFixed(2)} m/s`}
                sub={
                  buoy.currentDirection !== null
                    ? `toward ${degreesToCompass(buoy.currentDirection)}`
                    : undefined
                }
              />
              <Field
                label="Pressure"
                value={buoy.pressure === null ? '—' : `${buoy.pressure.toFixed(1)} mbar`}
              />
            </div>
          </>
        )}
      </div>

      {marineForecast && (marineForecast.wind || marineForecast.visibility || marineForecast.airTemperature) && (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-4">
          <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
            <p className="text-[11px] uppercase tracking-widest text-foreground/50">
              ECCC marine forecast
            </p>
            {forecastIssued && (
              <p className="text-xs font-mono text-foreground/60">issued {forecastIssued}</p>
            )}
          </div>
          {marineForecast.periodOfCoverage && (
            <p className="text-xs text-foreground/60 italic mb-2">{marineForecast.periodOfCoverage}</p>
          )}
          <dl className="space-y-1.5 text-sm">
            {marineForecast.wind && (
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-foreground/50">Wind</dt>
                <dd className="text-foreground/90">{marineForecast.wind}</dd>
              </div>
            )}
            {marineForecast.visibility && (
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-foreground/50">Weather & visibility</dt>
                <dd className="text-foreground/90">{marineForecast.visibility}</dd>
              </div>
            )}
            {marineForecast.airTemperature && (
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-foreground/50">Air temperature</dt>
                <dd className="text-foreground/90">{marineForecast.airTemperature}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <p className="text-[10px] text-foreground/40 px-1 leading-snug">
        Sources: SmartAtlantic Halifax (Herring Cove) buoy via CIOOS Atlantic; ECCC marine
        forecast for Halifax Harbour and Approaches; Windy.com map tiles & overlays. Buoy
        values are point measurements and may differ elsewhere in the harbour or on exposed
        coasts. No safety judgement is provided — verify with an official marine forecast
        before going out.
      </p>
    </div>
  );

  if (headless) {
    return <div className="mt-4">{body}</div>;
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
          <span className="text-xl" aria-hidden>🌊</span>
          <h2 className="text-lg font-bold text-foreground truncate">Marine & Wind Map</h2>
          <span className="text-xs text-foreground/40 truncate">· Halifax Harbour</span>
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
      {open && body}
    </section>
  );
}
