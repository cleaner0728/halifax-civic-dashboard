// Three colored "risk index" pills shown under the daily forecast strip.
// All three follow the same visual pattern; risk bucketing differs per metric.

import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';

type UvBucket = { label: string; bg: string; text: string };
type AqiBucket = UvBucket;
type BurnBucket = UvBucket;

// WHO UV scale: 0-2 low, 3-5 moderate, 6-7 high, 8-10 very high, 11+ extreme.
function uvBucket(uv: number): UvBucket {
  if (uv < 3) return { label: 'Low', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' };
  if (uv < 6) return { label: 'Moderate', bg: 'bg-amber-400/20', text: 'text-amber-700 dark:text-amber-300' };
  if (uv < 8) return { label: 'High', bg: 'bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300' };
  if (uv < 11) return { label: 'Very high', bg: 'bg-red-500/20', text: 'text-red-700 dark:text-red-300' };
  return { label: 'Extreme', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-700 dark:text-fuchsia-300' };
}

// US AQI bands: 0-50 good, 51-100 moderate, 101-150 unhealthy for sensitive groups, 151-200 unhealthy, 201-300 very unhealthy, 301+ hazardous.
function aqiBucket(aqi: number): AqiBucket {
  if (aqi <= 50) return { label: 'Good', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' };
  if (aqi <= 100) return { label: 'Moderate', bg: 'bg-amber-400/20', text: 'text-amber-700 dark:text-amber-300' };
  if (aqi <= 150)
    return { label: 'Unhealthy for sensitive', bg: 'bg-orange-500/20', text: 'text-orange-700 dark:text-orange-300' };
  if (aqi <= 200) return { label: 'Unhealthy', bg: 'bg-red-500/20', text: 'text-red-700 dark:text-red-300' };
  if (aqi <= 300) return { label: 'Very unhealthy', bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-700 dark:text-fuchsia-300' };
  return { label: 'Hazardous', bg: 'bg-rose-700/30', text: 'text-rose-100' };
}

function burnBucket(level: BurnStatus['level']): BurnBucket {
  switch (level) {
    case 'allowed':
      return { label: 'Burning allowed', bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' };
    case 'restricted':
      return { label: 'Burning restricted', bg: 'bg-amber-400/20', text: 'text-amber-700 dark:text-amber-300' };
    case 'no-burn':
      return { label: 'No burning', bg: 'bg-red-500/20', text: 'text-red-700 dark:text-red-300' };
  }
}

type Props = {
  uvIndex: number | null;        // current UV
  uvIndexMaxToday: number | null;
  airQuality: AirQuality | null;
  burnStatus: BurnStatus | null;
};

export default function WeatherPills({ uvIndex, uvIndexMaxToday, airQuality, burnStatus }: Props) {
  // If we have nothing to show, render nothing.
  if (uvIndex === null && airQuality === null && burnStatus === null) return null;

  const uv = uvIndex !== null ? uvBucket(uvIndex) : null;
  const aqi = airQuality ? aqiBucket(airQuality.aqi) : null;
  const burn = burnStatus ? burnBucket(burnStatus.level) : null;

  return (
    <div className="flex flex-wrap gap-2 px-6 py-3 bg-black/15">
      {uv && uvIndex !== null && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${uv.bg} ${uv.text}`}
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
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${aqi.bg} ${aqi.text}`}
          title={`PM2.5 ${airQuality.pm25} µg/m³`}
        >
          🌫️ AQI {airQuality.aqi} · {aqi.label}
        </span>
      )}
      {burn && burnStatus && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${burn.bg} ${burn.text}`}
          title={burnStatus.text}
        >
          🔥 {burn.label}
        </span>
      )}
    </div>
  );
}
