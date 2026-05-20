// Three colored "risk index" pills shown under the daily forecast strip.
// All three follow the same severity-badge visual: solid background, high-
// contrast text. Same color buckets across UV / AQI / Burn so green-yellow-
// orange-red-purple consistently mean low→extreme regardless of metric.

import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';

type Bucket = { label: string; text: string };

// Text-only severity colors — no background. Light tints so they're legible
// on dark banners (clearNight / cloudyNight / rain) while still visible on
// the lighter day gradients.
const SEVERITY = {
  low: { text: 'text-emerald-200' },
  moderate: { text: 'text-amber-200' },
  high: { text: 'text-orange-200' },
  veryHigh: { text: 'text-red-200' },
  extreme: { text: 'text-fuchsia-200' },
  hazardous: { text: 'text-rose-200' },
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

  // Mobile: stack vertically. Desktop: flex-wrap so all three sit inline.
  const itemClass = 'inline-flex items-center gap-1 text-xs sm:text-sm font-semibold';

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-y-1 sm:gap-x-4 px-4 sm:px-6 py-3">
      {uv && uvIndex !== null && (
        <span
          className={`${itemClass} ${uv.text}`}
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
        <span className={`${itemClass} ${aqi.text}`} title={`PM2.5 ${airQuality.pm25} µg/m³`}>
          🌫️ AQI {airQuality.aqi} · {aqi.label}
        </span>
      )}
      {burn && burnStatus && (
        <span className={`${itemClass} ${burn.text}`} title={burnStatus.text}>
          🔥 {burn.label}
        </span>
      )}
    </div>
  );
}
