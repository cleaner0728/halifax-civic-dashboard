import React from 'react';
import LiveClock from '@/components/LiveClock';
import HalifaxWebcams from '@/components/HalifaxWebcams';
import { HFX_TZ, getDayName, formatTime } from '@/lib/date';
import { getWeatherInfo } from '@/lib/weather-theme';
import type { WeatherData } from '@/lib/fetchers/weather';
import type { TideGraphData } from '@/lib/fetchers/tides';
import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';
import type { WeatherAlert } from '@/lib/fetchers/alerts';

type Props = {
  weather: WeatherData | null;
  tideGraph: TideGraphData | null;
  airQuality: AirQuality | null;
  burnStatus: BurnStatus | null;
  alerts: WeatherAlert[];
};

// Severity colour map — Tailwind needs the full class name in source so the
// JIT can find it; building strings at runtime (`bg-${color}-500/15`) would
// purge to nothing in production.
const ALERT_STYLES = {
  red: {
    container: 'bg-red-500/15 border-red-500/60 dark:bg-red-500/20 dark:border-red-500/50',
    badge: 'bg-red-500 text-white',
    title: 'text-red-700 dark:text-red-200',
    meta: 'text-red-700 dark:text-red-300',
  },
  amber: {
    container: 'bg-amber-500/15 border-amber-500/60 dark:bg-amber-500/15 dark:border-amber-500/50',
    badge: 'bg-amber-500 text-white',
    title: 'text-amber-800 dark:text-amber-200',
    meta: 'text-amber-800 dark:text-amber-300',
  },
  blue: {
    container: 'bg-blue-500/10 border-blue-500/40 dark:bg-blue-500/15 dark:border-blue-500/40',
    badge: 'bg-blue-500 text-white',
    title: 'text-blue-800 dark:text-blue-200',
    meta: 'text-blue-800 dark:text-blue-300',
  },
} as const;

const SEVERITY_LABEL: Record<WeatherAlert['severity'], string> = {
  warning: 'WARNING',
  watch: 'WATCH',
  advisory: 'ADVISORY',
  statement: 'STATEMENT',
  unknown: 'ALERT',
};

function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}
function uvLabel(uv: number) {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}
function uvColor(uv: number) {
  if (uv < 3) return 'text-emerald-700 dark:text-emerald-200';
  if (uv < 6) return 'text-amber-700 dark:text-amber-200';
  if (uv < 8) return 'text-orange-700 dark:text-orange-200';
  if (uv < 11) return 'text-red-700 dark:text-red-200';
  return 'text-fuchsia-700 dark:text-fuchsia-200';
}
function aqiLabel(aqi: number) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}
function aqiColor(aqi: number) {
  if (aqi <= 50) return 'text-emerald-700 dark:text-emerald-200';
  if (aqi <= 100) return 'text-amber-700 dark:text-amber-200';
  if (aqi <= 150) return 'text-orange-700 dark:text-orange-200';
  if (aqi <= 200) return 'text-red-700 dark:text-red-200';
  if (aqi <= 300) return 'text-fuchsia-700 dark:text-fuchsia-200';
  return 'text-rose-700 dark:text-rose-200';
}
function burnLabel(level: BurnStatus['level']) {
  if (level === 'allowed') return 'Allowed';
  if (level === 'restricted') return 'Restricted';
  return 'No burning';
}
function burnColor(level: BurnStatus['level']) {
  if (level === 'allowed') return 'text-emerald-700 dark:text-emerald-200';
  if (level === 'restricted') return 'text-amber-700 dark:text-amber-200';
  return 'text-red-700 dark:text-red-200';
}

function boldNumbers(text: string): React.ReactNode[] {
  return text.split(/(\d+(?:\.\d+)?)/).map((part, i) =>
    /^\d+(?:\.\d+)?$/.test(part) ? <strong key={i} className="font-bold">{part}</strong> : part
  );
}

export default function WeatherScreen({ weather, tideGraph, airQuality, burnStatus, alerts }: Props) {
  const currentWeather = weather ? getWeatherInfo(weather.weatherCode, !weather.isDay) : null;

  return (
    <div className="pt-20 pb-24 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        {alerts.length > 0 && (
          // Stack alerts above the weather card so they're the first thing
          // a user sees on opening the dashboard. The whole card is still
          // the tap target (opens ECCC for any updates), but we now inline
          // every piece of structured info ECCC publishes — title, impact,
          // confidence, issued time, affected area, full descriptive text —
          // so the reader doesn't have to tap through to know what's
          // happening or what to do.
          <div className="space-y-2 mb-4">
            {alerts.map((a) => {
              const styles = ALERT_STYLES[a.color];
              return (
                <a
                  key={a.title + a.issuedAt}
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group block rounded-xl border-2 p-3 transition-all hover:shadow-lg ${styles.container}`}
                >
                  {/* Icon + severity badge + title all inline so the text
                      column below the header uses the full card width on
                      mobile, instead of leaving dead space under the icon. */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span aria-hidden className="text-xl leading-none">⚠️</span>
                    <span className={`text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded ${styles.badge}`}>
                      {SEVERITY_LABEL[a.severity]}
                    </span>
                    <h3 className={`text-base sm:text-lg font-bold leading-tight ${styles.title}`}>
                      {a.title}
                    </h3>
                  </div>

                  <p className={`text-xs mt-1 ${styles.meta}`}>{a.affectedArea}</p>

                  {/* Meta row: impact / confidence / issued time. Three
                      distinct facts, separated by middle-dots so the
                      row reads as one phrase on wide screens but wraps
                      cleanly on narrow ones. */}
                  <p className={`text-sm mt-0.5 ${styles.meta} flex flex-wrap gap-x-2 gap-y-0.5`}>
                    <span>Impact: <strong className="font-semibold">{a.impact}</strong></span>
                    <span aria-hidden>·</span>
                    <span>Confidence: <strong className="font-semibold">{a.confidence}</strong></span>
                    {a.issuedText && (
                      <>
                        <span aria-hidden>·</span>
                        <span className={`font-semibold ${styles.title}`}>
                          Issued {boldNumbers(a.issuedText)}
                        </span>
                      </>
                    )}
                  </p>

                  {/* Full alert body. ECCC writes this with paragraph
                      breaks ('\n\n') and within-paragraph line breaks
                      ('\n'). `whitespace-pre-line` honours both, so
                      we can drop the raw string in unchanged. */}
                  {a.description && (
                    <p className={`text-sm mt-2 whitespace-pre-line leading-snug ${styles.title}`}>
                      {boldNumbers(a.description)}
                    </p>
                  )}

                  <p className={`text-[11px] mt-2 ${styles.meta}`}>
                    Source: Environment Canada
                    <span aria-hidden className="inline-block ml-1 transition-transform group-hover:translate-x-0.5">↗</span>
                  </p>
                </a>
              );
            })}
          </div>
        )}
        {weather && currentWeather && (
          <section
            className={`rounded-2xl overflow-hidden shadow-xl mb-6 ${currentWeather.theme.container} ${currentWeather.theme.textPrimary}`}
          >
            <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4">
              {tideGraph && (
                <div className="mb-4">
                  <div className={`grid grid-cols-3 gap-x-3 text-xs sm:text-sm mb-2 ${currentWeather.theme.textSecondary}`}>
                    <div>
                      <div className="opacity-80">🌊 Now</div>
                      <div className="font-semibold text-sm sm:text-base">
                        {tideGraph.currentLevel.toFixed(2)} m
                      </div>
                    </div>
                    {tideGraph.nextHigh && (
                      <div>
                        <div className="opacity-80">↑ High</div>
                        <div className="font-semibold text-sm sm:text-base leading-tight">
                          {tideGraph.nextHigh.value.toFixed(2)} m
                        </div>
                        <div className="opacity-80 text-[11px] sm:text-xs">
                          {new Date(tideGraph.nextHigh.time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: HFX_TZ,
                          })}
                        </div>
                      </div>
                    )}
                    {tideGraph.nextLow && (
                      <div>
                        <div className="opacity-80">↓ Low</div>
                        <div className="font-semibold text-sm sm:text-base leading-tight">
                          {tideGraph.nextLow.value.toFixed(2)} m
                        </div>
                        <div className="opacity-80 text-[11px] sm:text-xs">
                          {new Date(tideGraph.nextLow.time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: HFX_TZ,
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-md overflow-hidden" style={{ height: 52 }}>
                    <svg viewBox="0 0 800 72" width="100%" height="100%" preserveAspectRatio="none">
                      <polygon points={tideGraph.fillPoints} fill="rgba(255,255,255,0.15)" />
                      <polyline
                        points={tideGraph.linePoints}
                        fill="none"
                        stroke="rgba(255,255,255,0.75)"
                        strokeWidth="7.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <line
                        x1={tideGraph.nowX}
                        y1="0"
                        x2={tideGraph.nowX}
                        y2="72"
                        stroke="rgba(255,255,255,0.9)"
                        strokeWidth="2"
                        strokeDasharray="4,3"
                      />
                      {tideGraph.nextHigh && (
                        <circle cx={tideGraph.nextHighX} cy={tideGraph.nextHighY} r="6" fill="white" fillOpacity="0.9" />
                      )}
                      {tideGraph.nextLow && (
                        <circle cx={tideGraph.nextLowX} cy={tideGraph.nextLowY} r="6" fill="white" fillOpacity="0.9" />
                      )}
                    </svg>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className={`flex items-center gap-2 text-xs sm:text-sm font-medium uppercase tracking-wide sm:tracking-widest ${currentWeather.theme.textSecondary}`}
                  >
                    <p>Halifax, NS</p>
                    <span>•</span>
                    <LiveClock />
                  </div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-5xl font-bold tracking-tighter">{Math.round(weather.temperature)}°C</span>
                    <span className={`text-lg ${currentWeather.theme.textSecondary}`}>
                      Feels {Math.round(weather.apparentTemp)}°
                    </span>
                  </div>
                  <p className="text-base font-medium mt-1">{currentWeather.label}</p>
                </div>
                <div className="text-4xl">{currentWeather.emoji}</div>
              </div>
              {/* Unified conditions grid — all metrics together, no icons */}
              <div className="mt-4 space-y-3">
                {/* Row 1: Weather conditions */}
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 ${currentWeather.theme.textSecondary}`}>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-60">Wind</p>
                    <p className="text-sm font-semibold mt-0.5">
                      <span className="font-mono">{degreesToCompass(weather.windDirection)}</span>
                      {' · '}{weather.windSpeed} km/h
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest opacity-60">Humidity</p>
                    <p className="text-sm font-semibold mt-0.5">{weather.humidity}%</p>
                  </div>
                  {weather.daily[0] && (
                    <>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-60">Sunrise</p>
                        <p className="text-sm font-semibold mt-0.5">{formatTime(weather.daily[0].sunrise)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-60">Sunset</p>
                        <p className="text-sm font-semibold mt-0.5">{formatTime(weather.daily[0].sunset)}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Divider + Row 2: Air quality / risk indices */}
                {(weather.uvIndex !== null || airQuality || burnStatus) && (
                  <>
                    <div className="border-t border-black/10 dark:border-white/15" />
                    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 ${currentWeather.theme.textSecondary}`}>
                      {weather.uvIndex !== null && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-60">UV Index</p>
                          <p className={`text-sm font-semibold mt-0.5 ${uvColor(weather.uvIndex)}`}>
                            {Math.round(weather.uvIndex)} — {uvLabel(weather.uvIndex)}
                          </p>
                        </div>
                      )}
                      {airQuality && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-60">Air Quality</p>
                          <p className={`text-sm font-semibold mt-0.5 ${aqiColor(airQuality.aqi)}`}>
                            {airQuality.aqi} — {aqiLabel(airQuality.aqi)}
                          </p>
                        </div>
                      )}
                      {burnStatus && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-60">Open Burning</p>
                          <p className={`text-sm font-semibold mt-0.5 ${burnColor(burnStatus.level)}`}>
                            {burnLabel(burnStatus.level)}
                          </p>
                          {/* Show the upstream detail string (e.g. "Burning
                              is only allowed between 7:00 pm and 8:00 am")
                              — the label alone could mislead a user into
                              thinking "Allowed" means anytime. */}
                          {burnStatus.text && (
                            <p className="text-[11px] mt-0.5 opacity-70 leading-snug">
                              {burnStatus.text}
                            </p>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] uppercase tracking-widest opacity-60">Pressure</p>
                        <p className="text-sm font-semibold mt-0.5">{Math.round(weather.pressure)} hPa</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className={`${currentWeather.theme.bottomBar} px-3 sm:px-6 py-4`}>
              <div className="grid grid-cols-5 gap-1">
                {weather.daily.map((day) => {
                  const info = getWeatherInfo(day.weatherCode);
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-0.5 text-center">
                      <span className={`text-[11px] sm:text-xs font-medium uppercase ${currentWeather.theme.textSecondary}`}>
                        {getDayName(day.date)}
                      </span>
                      <span className="text-2xl">{info.emoji}</span>
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-xs sm:text-sm font-semibold">{Math.round(day.maxTemp)}°</span>
                        <span className={`text-[11px] sm:text-xs ${currentWeather.theme.textSecondary}`}>{Math.round(day.minTemp)}°</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <HalifaxWebcams />
      </div>
    </div>
  );
}
