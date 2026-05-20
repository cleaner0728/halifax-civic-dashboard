import LiveClock from '@/components/LiveClock';
import WeatherPills from '@/components/WeatherPills';
import MacDonaldBridgeWebcam from '@/components/MacDonaldBridgeWebcam';
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

export default function WeatherScreen({ weather, tideGraph, airQuality, burnStatus }: Props) {
  const currentWeather = weather ? getWeatherInfo(weather.weatherCode, !weather.isDay) : null;

  return (
    <div className="pt-[88px] pb-8 min-h-screen">
      <div className="max-w-5xl mx-auto px-2 mt-4">
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
              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-4 text-sm ${currentWeather.theme.textSecondary}`}>
                <span>💨 {weather.windSpeed} km/h</span>
                <span>💧 {weather.humidity}%</span>
                {weather.daily[0] && (
                  <>
                    <span>🌅 {formatTime(weather.daily[0].sunrise)}</span>
                    <span>🌇 {formatTime(weather.daily[0].sunset)}</span>
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
            <WeatherPills
              uvIndex={weather.uvIndex}
              uvIndexMaxToday={weather.uvIndexMaxToday}
              airQuality={airQuality}
              burnStatus={burnStatus}
            />
          </section>
        )}

        <MacDonaldBridgeWebcam />
      </div>
    </div>
  );
}
