import React from 'react';
import LiveClock from '@/components/LiveClock';
import { HFX_TZ, getDayName, formatTime } from '@/lib/date';
import { getWeatherInfo } from '@/lib/weather-theme';
import type { WeatherData } from '@/lib/fetchers/weather';
import type { TideGraphData } from '@/lib/fetchers/tides';
import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';

type Props = {
  weather: WeatherData | null;
  tideGraph: TideGraphData | null;
  airQuality: AirQuality | null;
  burnStatus: BurnStatus | null;
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

export default function WeatherBlock({ weather, tideGraph, airQuality, burnStatus }: Props) {
  if (!weather) return null;
  const currentWeather = getWeatherInfo(weather.weatherCode, !weather.isDay);

  return (
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

        {weather.hourly.length > 0 && (
          <div data-no-tab-swipe className="mt-4 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-1 w-max pb-1">
              {weather.hourly.map((h, i) => {
                const localHour = new Date(h.timestamp).toLocaleString('en-US', {
                  hour: 'numeric',
                  hour12: true,
                  timeZone: HFX_TZ,
                });
                const info = getWeatherInfo(h.weatherCode, false);
                return (
                  <div
                    key={h.timestamp}
                    className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg min-w-[52px] text-center ${
                      i === 0
                        ? 'bg-white/20 dark:bg-white/15'
                        : 'bg-white/10 dark:bg-white/8'
                    }`}
                  >
                    <span className={`text-[11px] font-medium ${currentWeather.theme.textSecondary}`}>
                      {i === 0 ? 'Now' : localHour}
                    </span>
                    <span className="text-xl leading-none">{info.emoji}</span>
                    <span className="text-sm font-semibold">{Math.round(h.temp)}°</span>
                    {h.pop > 0 && (
                      <span className={`text-[10px] ${currentWeather.theme.textSecondary}`}>
                        {h.pop}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={`mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-3 ${currentWeather.theme.textSecondary}`}>
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
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-60">Dewpoint</p>
            <p className="text-sm font-semibold mt-0.5">{weather.dewpoint}°C</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-60">Visibility</p>
            <p className="text-sm font-semibold mt-0.5">{weather.visibility} km</p>
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
      </div>
      <div className={`${currentWeather.theme.bottomBar} px-3 sm:px-6 py-4`}>
        <div data-no-tab-swipe className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-1 min-w-full">
            {weather.daily.map((day) => {
              const info = getWeatherInfo(day.weatherCode);
              return (
                <div key={day.date} className="flex flex-col items-center gap-0.5 text-center flex-1 min-w-[60px] px-1">
                  <span className={`text-[11px] sm:text-xs font-medium uppercase ${currentWeather.theme.textSecondary}`}>
                    {getDayName(day.date)}
                  </span>
                  <span className="text-2xl">{info.emoji}</span>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-xs sm:text-sm font-semibold">{Math.round(day.maxTemp)}°</span>
                    <span className={`text-[11px] sm:text-xs ${currentWeather.theme.textSecondary}`}>{Math.round(day.minTemp)}°</span>
                  </div>
                  {day.textSummary && (
                    <span className={`text-[9px] sm:text-[10px] leading-tight opacity-70 mt-0.5 max-w-[60px] ${currentWeather.theme.textSecondary}`}>
                      {day.textSummary}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
