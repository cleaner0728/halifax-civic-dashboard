// Three colored "risk index" pills shown under the daily forecast strip.
// All three follow the same severity-badge visual: solid background, high-
// contrast text. Same color buckets across UV / AQI / Burn so green-yellow-
// orange-red-purple consistently mean low→extreme regardless of metric.

import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';

type Bucket = { label: string; bg: string; text: string };

// Solid colors with explicit text contrast — works on any weather banner.
// Amber gets dark text because the swatch is too light for white.
const SEVERITY = {
  low: { bg: 'bg-emerald-600', text: 'text-white' },
  moderate: { bg: 'bg-amber-400', text: 'text-amber-950' },
  high: { bg: 'bg-orange-500', text: 'text-white' },
  veryHigh: { bg: 'bg-red-600', text: 'text-white' },
  extreme: { bg: 'bg-fuchsia-600', text: 'text-white' },
  hazardous: { bg: 'bg-rose-800', text: 'text-white' },
} as const;

// WHO UV scale: 0-2 low, 3-5 moderate, 6-7 high, 8-10 very high, 11+ extreme.
function uvBucket(uv: number): Bucket {
  if (uv < 3) return { label: 'Low', ...SEVERITY.low };
  if (uv < 6) return { label: 'Moderate', ...SEVERITY.moderate };
  if (uv < 8) return { label: 'High', ...SEVERITY.high };
  if (uv < 11) return { label: 'Very high', ...SEVERITY.veryHigh };
  return { label: 'Extreme', ...SEVERITY.extreme };
}

// US AQI bands.
function aqiBucket(aqi: number): Bucket {
  if (aqi <= 50) return { label: 'Good', ...SEVERITY.low };
  if (aqi <= 100) return { label: 'Moderate', ...SEVERITY.moderate };
  if (aqi <= 150) return { label: 'Unhealthy for sensitive', ...SEVERITY.high };
  if (aqi <= 200) return { label: 'Unhealthy', ...SEVERITY.veryHigh };
  if (aqi <= 300) return { label: 'Very unhealthy', ...SEVERITY.extreme };
  return { label: 'Hazardous', ...SEVERITY.hazardous };
}

function burnBucket(level: BurnStatus['level']): Bucket {
  switch (level) {
    case 'allowed':
      return { label: 'Burning allowed', ...SEVERITY.low };
    case 'restricted':
      return { label: 'Burning restricted', ...SEVERITY.moderate };
    case 'no-burn':
      return { label: 'No burning', ...SEVERITY.veryHigh };
  }
}

type Props = {
  uvIndex: number | null;
  uvIndexMaxToday: number | null;
  airQuality: AirQuality | null;
  burnStatus: BurnStatus | null;
};

export default function WeatherPills({ uvIndex, uvIndexMaxToday, airQuality, burnStatus }: Props) {
  if (uvIndex === null && airQuality === null && burnStatus === null) return null;

  const uv = uvIndex !== null ? uvBucket(uvIndex) : null;
  const aqi = airQuality ? aqiBucket(airQuality.aqi) : null;
  const burn = burnStatus ? burnBucket(burnStatus.level) : null;

  // Mobile: predictable 2-col grid (UV + AQI side-by-side, burn full-width below).
  // Desktop: flex-wrap so all three sit inline.
  const pillClass =
    'place-self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm';

  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 px-4 sm:px-6 py-3">
      {uv && uvIndex !== null && (
        <span
          className={`${pillClass} ${uv.bg} ${uv.text}`}
          title={
            uvIndexMaxToday !== null && uvIndexMaxToday > uvIndex
              ? `Peak today ${uvIndexMaxToday.toFixed(0)}`
              : undefined
          }
        >
          ☀️ UV {Math.round(uvIndex)} · {uv.label}
        </span>
      )}
      {aqi && airQuality && (
        <span className={`${pillClass} ${aqi.bg} ${aqi.text}`} title={`PM2.5 ${airQuality.pm25} µg/m³`}>
          🌫️ AQI {airQuality.aqi} · {aqi.label}
        </span>
      )}
      {burn && burnStatus && (
        <span
          className={`${pillClass} col-span-2 sm:col-auto ${burn.bg} ${burn.text}`}
          title={burnStatus.text}
        >
          🔥 {burn.label}
        </span>
      )}
    </div>
  );
}
