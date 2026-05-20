import Image from 'next/image';
import LiveClock from '@/components/LiveClock';
import WeatherPills from '@/components/WeatherPills';
import { HFX_TZ, getDayName, formatTime } from '@/lib/date';
import { getWeatherInfo } from '@/lib/weather-theme';
import type { WeatherData } from '@/lib/fetchers/weather';
import type { NewsItem } from '@/lib/fetchers/news';
import type { TideGraphData } from '@/lib/fetchers/tides';
import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';

type Props = {
  weather: WeatherData | null;
  news: { items: NewsItem[] };
  tideGraph: TideGraphData | null;
  airQuality: AirQuality | null;
  burnStatus: BurnStatus | null;
};

export default function NewsAndWeatherScreen({ weather, news, tideGraph, airQuality, burnStatus }: Props) {
  const currentWeather = weather ? getWeatherInfo(weather.weatherCode, !weather.isDay) : null;

  return (
    <div data-screen-scroll className="pt-[140px] pb-8 h-screen overflow-y-auto">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        {weather && currentWeather && (
          <section
            className={`rounded-2xl overflow-hidden shadow-xl mb-6 ${currentWeather.theme.container} ${currentWeather.theme.textPrimary}`}
          >
            <div className="px-6 pt-6 pb-4">
              {tideGraph && (
                <div className="mb-4">
                  <div className={`flex flex-wrap gap-x-5 gap-y-1 text-sm mb-2 ${currentWeather.theme.textSecondary}`}>
                    <span>
                      🌊 <span className="font-semibold">{tideGraph.currentLevel.toFixed(2)} m</span>
                    </span>
                    {tideGraph.nextHigh && (
                      <span>
                        ↑ High <span className="font-semibold">{tideGraph.nextHigh.value.toFixed(2)} m</span> ·{' '}
                        {new Date(tideGraph.nextHigh.time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: HFX_TZ,
                        })}
                      </span>
                    )}
                    {tideGraph.nextLow && (
                      <span>
                        ↓ Low <span className="font-semibold">{tideGraph.nextLow.value.toFixed(2)} m</span> ·{' '}
                        {new Date(tideGraph.nextLow.time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                          timeZone: HFX_TZ,
                        })}
                      </span>
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
                    className={`flex items-center gap-2 text-sm font-medium uppercase tracking-widest ${currentWeather.theme.textSecondary}`}
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
              <div className={`flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm ${currentWeather.theme.textSecondary}`}>
                <span>💨 {weather.windSpeed} km/h</span>
                <span>💧 {weather.humidity}%</span>
                {weather.daily[0] && (
                  <>
                    <span>🌅 Sunrise {formatTime(weather.daily[0].sunrise)}</span>
                    <span>🌇 Sunset {formatTime(weather.daily[0].sunset)}</span>
                  </>
                )}
              </div>
            </div>
            <div className={`${currentWeather.theme.bottomBar} px-6 py-4`}>
              <div className="grid grid-cols-5 gap-1">
                {weather.daily.map((day) => {
                  const info = getWeatherInfo(day.weatherCode);
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-1 text-center">
                      <span className={`text-xs font-medium uppercase ${currentWeather.theme.textSecondary}`}>
                        {getDayName(day.date)}
                      </span>
                      <span className="text-2xl">{info.emoji}</span>
                      <div className="text-xs">
                        <span className="font-semibold">{Math.round(day.maxTemp)}°</span>
                        <span className={`ml-1 ${currentWeather.theme.textSecondary}`}>{Math.round(day.minTemp)}°</span>
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

        <h2 className="text-lg font-bold mb-4">
          Latest News <span className="text-sm font-normal text-foreground/40">· past 24 hours</span>
        </h2>
        <div className="space-y-5 pb-16">
          {news.items.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">📭</p>
              <p className="text-lg font-medium">No news in the past 12 hours.</p>
            </div>
          ) : (
            news.items.map((item, index) => (
              <article
                key={index}
                className="bg-card rounded-xl border border-border hover:border-foreground/15 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className={`flex ${item.imageUrl ? 'flex-col sm:flex-row' : ''}`}>
                  {item.imageUrl && (
                    <div className="relative h-52 sm:h-auto sm:min-h-[160px] sm:w-72 sm:shrink-0">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block absolute inset-0"
                      >
                        <Image
                          src={item.imageUrl}
                          alt={item.title || 'News image'}
                          fill
                          sizes="(min-width: 640px) 18rem, 100vw"
                          className="object-cover"
                          // RSS images come from arbitrary CDNs — let Next proxy them
                          // (this also sidesteps Chrome ORB blocking cross-origin
                          // image responses with mismatched MIME).
                          unoptimized={false}
                        />
                      </a>
                    </div>
                  )}
                  <div className="p-2 flex-1 min-w-0">
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-semibold text-foreground hover:text-blue-500 dark:hover:text-blue-400 transition-colors leading-snug"
                    >
                      {item.title}
                    </a>
                    <p className="text-xs text-foreground/40 mt-1 font-mono">
                      {item.source && <span className="text-blue-400 mr-2">{item.source}</span>}
                      {item.pubDate
                        ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' })
                        : 'Unknown'}
                    </p>
                    <p className="text-foreground/60 mt-1 text-base leading-relaxed">{item.contentSnippet}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
