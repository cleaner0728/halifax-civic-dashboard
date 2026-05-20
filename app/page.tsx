import ThemeToggle from '@/components/ThemeToggle';
import InstallButton from '@/components/InstallButton';
import ScrollSnapContainer from '@/components/ScrollSnapContainer';
import LiveClock from '@/components/LiveClock';
import { HFX_TZ, getDayName, formatTime, timeAgo } from '@/lib/date';
import { getWeatherInfo } from '@/lib/weather-theme';
import { fetchWeather } from '@/lib/fetchers/weather';
import { fetchNews, type NewsItem } from '@/lib/fetchers/news';
import { fetchHrmNews, fetchHrfeIncidents, type HrmItem } from '@/lib/fetchers/hrm';
import { fetchTransitRss, fetchTransitDetours, type TransitDetour } from '@/lib/fetchers/transit';
import { fetchTides, computeTideGraph, type TideGraphData } from '@/lib/fetchers/tides';
import { fetchRedditPosts, type RedditPost } from '@/lib/fetchers/reddit';

// ============ Page Component ============

export default async function Home() {
  const [weather, news, hrmResult, hrfeIncidents, transitDetours, transitHasRecent, tides, redditData] = await Promise.all([
    fetchWeather(),
    fetchNews(),
    fetchHrmNews(),
    fetchHrfeIncidents(),
    fetchTransitDetours(),
    fetchTransitRss(),
    fetchTides(),
    fetchRedditPosts(),
  ]);
  const redditPosts = redditData.posts;
  const redditFetchedAt = redditData.fetchedAt;

  const currentWeather = weather ? getWeatherInfo(weather.weatherCode, !weather.isDay) : null;
  const hrmNews = hrmResult.items;
  const hrmDateLabel = hrmResult.dateLabel;
  const tideGraph = computeTideGraph(tides);

  return (
    <main className="bg-background text-foreground">
      <ScrollSnapContainer 
        labels={["News & Weather", "HRM News", "HRFE Incidents", "Transit Disruption", "Events Calendar", "r/halifax"]}
        topBar={
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold tracking-tight">📰 Halifax Dashboard</h1>
            <div className="flex items-center gap-2">
              <InstallButton />
              <ThemeToggle />
            </div>
          </div>
        }
      >
        {/* ========== SCREEN 1: Weather + Global News ========== */}
        <div className="pt-[140px] pb-8 h-screen overflow-y-auto">
          <div className="max-w-5xl mx-auto px-2 mt-4">
            {/* Hero Weather Banner */}
            {weather && currentWeather && (
              <section className={`rounded-2xl overflow-hidden shadow-xl mb-6 ${currentWeather.theme.container} ${currentWeather.theme.textPrimary}`}>
                <div className="px-6 pt-6 pb-4">
                  {/* Tide Graph — above temperature */}
                  {tideGraph && (
                    <div className="mb-4">
                      <div className={`flex flex-wrap gap-x-5 gap-y-1 text-sm mb-2 ${currentWeather.theme.textSecondary}`}>
                        <span>🌊 <span className="font-semibold">{tideGraph.currentLevel.toFixed(2)} m</span></span>
                        {tideGraph.nextHigh && (
                          <span>↑ High <span className="font-semibold">{tideGraph.nextHigh.value.toFixed(2)} m</span> · {new Date(tideGraph.nextHigh.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: HFX_TZ })}</span>
                        )}
                        {tideGraph.nextLow && (
                          <span>↓ Low <span className="font-semibold">{tideGraph.nextLow.value.toFixed(2)} m</span> · {new Date(tideGraph.nextLow.time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: HFX_TZ })}</span>
                        )}
                      </div>
                      <div className="rounded-md overflow-hidden" style={{ height: 52 }}>
                        <svg viewBox="0 0 800 72" width="100%" height="100%" preserveAspectRatio="none">
                          <polygon points={tideGraph.fillPoints} fill="rgba(255,255,255,0.15)" />
                          <polyline points={tideGraph.linePoints} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="7.5" strokeLinejoin="round" strokeLinecap="round" />
                          <line x1={tideGraph.nowX} y1="0" x2={tideGraph.nowX} y2="72" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeDasharray="4,3" />
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
                      <div className={`flex items-center gap-2 text-sm font-medium uppercase tracking-widest ${currentWeather.theme.textSecondary}`}>
                        <p>Halifax, NS</p>
                        <span>•</span>
                        <LiveClock />
                      </div>
                      <div className="flex items-baseline gap-3 mt-1">
                        <span className="text-5xl font-bold tracking-tighter">
                          {Math.round(weather.temperature)}°C
                        </span>
                        <span className={`text-lg ${currentWeather.theme.textSecondary}`}>
                          Feels {Math.round(weather.apparentTemp)}°
                        </span>
                      </div>
                      <p className="text-base font-medium mt-1">
                        {currentWeather.label}
                      </p>
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
              </section>
            )}

            {/* News Feed */}
            <h2 className="text-lg font-bold mb-4">Latest News <span className="text-sm font-normal text-foreground/40">· past 24 hours</span></h2>
            <div className="space-y-5 pb-16">
              {news.items.length === 0 ? (
                <div className="text-center py-16 text-foreground/40">
                  <p className="text-4xl mb-4">📭</p>
                  <p className="text-lg font-medium">No news in the past 12 hours.</p>
                </div>
              ) : news.items.map((item, index) => (
                <article
                  key={index}
                  className="bg-card rounded-xl border border-border hover:border-foreground/15 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  <div className={`flex ${item.imageUrl ? 'flex-col sm:flex-row' : ''}`}>
                    {item.imageUrl && (
                      <div className="sm:w-72 sm:shrink-0">
                        <a href={item.link} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt={item.title || 'News image'}
                            className="w-full h-52 sm:h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
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
                        {item.pubDate ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' }) : 'Unknown'}
                      </p>
                      <p className="text-foreground/60 mt-1 text-base leading-relaxed">
                        {item.contentSnippet}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        {/* ========== SCREEN 2: HRM Municipal News ========== */}
        <div className="pt-[140px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
          <div className="max-w-5xl mx-auto px-2 mt-4">
            {/* HRM Header */}
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 dark:from-emerald-800 dark:via-teal-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                    Halifax Regional Municipality
                  </p>
                  <h2 className="text-3xl font-bold tracking-tight mt-1">HRM News</h2>
                  <p className="text-base text-white/70 mt-1">
                    Municipal updates · {hrmDateLabel}
                  </p>
                </div>
                <div className="text-5xl">🏛️</div>
              </div>
            </div>

            {/* HRM News Items */}
            <div className="space-y-4 pb-16">
              {hrmNews.length === 0 ? (
                <div className="text-center py-16 text-foreground/40">
                  <p className="text-4xl mb-4">📭</p>
                  <p className="text-lg font-medium">No HRM news published today.</p>
                  <p className="text-sm mt-1">Check back later for updates from Halifax City Hall.</p>
                </div>
              ) : (
                hrmNews.map((item, index) => (
                  <article
                    key={index}
                    className="bg-card rounded-xl border border-border hover:border-emerald-500/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="p-2">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-semibold text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors leading-snug"
                      >
                        {item.title}
                      </a>
                      <p className="text-xs text-foreground/40 mt-1 font-mono">
                        {item.pubDate ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' }) : 'Unknown'}
                      </p>
                      {item.description && (
                        <p className="text-foreground/60 mt-1 text-base leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ========== SCREEN 3: HRFE Incident Feed ========== */}
        <div className="pt-[140px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
          <div className="max-w-5xl mx-auto px-2 mt-4">
            {/* HRFE Header */}
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-red-500 via-orange-600 to-amber-600 dark:from-red-800 dark:via-orange-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                    Halifax Regional Fire & Emergency
                  </p>
                  <h2 className="text-3xl font-bold tracking-tight mt-1">HRFE Incidents</h2>
                  <p className="text-base text-white/70 mt-1">
                    Past 6 hours · {hrfeIncidents.length} incident{hrfeIncidents.length !== 1 ? 's' : ''} ·{' '}
                    <a
                      href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-white"
                    >
                      HRFE Incident Feed
                    </a>
                  </p>
                </div>
                <div className="text-5xl">🚒</div>
              </div>
            </div>

            {/* HRFE Incident Items */}
            <div className="space-y-3 pb-16">
              {hrfeIncidents.length === 0 ? (
                <div className="text-center py-16 text-foreground/40">
                  <p className="text-4xl mb-4">✅</p>
                  <p className="text-lg font-medium">No active incidents.</p>
                  <p className="text-sm mt-1">All clear in the Halifax region.</p>
                </div>
              ) : (
                hrfeIncidents.map((item, index) => (
                  <article
                    key={index}
                    className="bg-card rounded-xl border border-border hover:border-red-500/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="p-2">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-semibold text-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors leading-snug"
                      >
                        {item.title}
                      </a>
                      <p className="text-xs text-foreground/40 mt-1 font-mono">
                        {item.pubDate ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' }) : 'Unknown'}
                      </p>
                      {item.description && (
                        <p className="text-foreground/60 mt-1 text-base leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ========== SCREEN 4: Transit Disruptions ========== */}
        <div className="pt-[140px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
          <div className="max-w-5xl mx-auto px-2 mt-4">
            {/* Header */}
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 dark:from-amber-900 dark:via-orange-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                    Halifax Transit
                  </p>
                  <h2 className="text-3xl font-bold tracking-tight mt-1">Transit Disruption</h2>
                  <p className="text-base text-white/70 mt-1">
                    Active detours · {transitDetours.length} disruption{transitDetours.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-5xl">🚌</div>
              </div>
            </div>

            {/* Detour Cards */}
            <div className="space-y-4 pb-16">
              {transitDetours.length === 0 ? (
                <div className="text-center py-16 text-foreground/40">
                  <p className="text-4xl mb-4">✅</p>
                  <p className="text-lg font-medium">No active detours.</p>
                  <p className="text-sm mt-1">Halifax Transit is running on regular routes.</p>
                </div>
              ) : (
                transitDetours.map((detour, index) => (
                  <article
                    key={index}
                    className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    {/* Title strip */}
                    <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-center gap-2">
                      <span className="text-xl">🚌</span>
                      <h3 className="font-bold text-foreground leading-snug">{detour.title}</h3>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Date + Time — prominent */}
                      <div className="flex flex-wrap gap-6">
                        {(detour.date || detour.startDate) && (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                              {detour.startDate ? 'Start Date' : 'Date'}
                            </div>
                            <div className="text-xl font-bold text-foreground">
                              📅 {detour.startDate ?? detour.date}
                            </div>
                          </div>
                        )}
                        {detour.endDate && (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">End Date</div>
                            <div className="text-xl font-bold text-foreground">📅 {detour.endDate}</div>
                          </div>
                        )}
                        {detour.time && (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">Time</div>
                            <div className="text-xl font-bold text-amber-500 dark:text-amber-400">
                              ⏰ {detour.time}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Location */}
                      {detour.location && (
                        <p className="text-sm text-foreground/60">📍 {detour.location}</p>
                      )}

                      {/* Route badges */}
                      {detour.routes && (
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-2">
                            Affected Routes
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {detour.routes.split(',').map(r => r.trim()).filter(Boolean).map(route => (
                              <span
                                key={route}
                                className="inline-block bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md px-2.5 py-0.5 text-base font-mono font-bold"
                              >
                                {route}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Summary — context/reason, de-emphasised */}
                      {detour.summary && (
                        <p className="text-sm text-foreground/50 leading-relaxed border-t border-border/50 pt-3">
                          {detour.summary}
                        </p>
                      )}

                      {transitHasRecent && (
                        <a
                          href="https://www.halifax.ca/transportation/halifax-transit/service-disruptions"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-sm text-amber-600 dark:text-amber-400 hover:underline"
                        >
                          → View source on halifax.ca
                        </a>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
        {/* ========== SCREEN 5: Events Calendar ========== */}
        <div className="pt-[140px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
          <div className="max-w-5xl mx-auto px-2 mt-4">
            <p className="text-xl font-semibold text-center text-foreground mb-3">📅 Upcoming civic events · Halifax, NS</p>

            {/* Google Calendar Embed */}
            <div className="rounded-xl overflow-hidden border border-border shadow-sm bg-white p-2 mb-4">
              <iframe
                src="https://calendar.google.com/calendar/embed?showTitle=0&mode=AGENDA&height=600&wkst=1&bgcolor=%23FFFFFF&src=dd2f3gg1q7g2sodi34c479jqmk%40group.calendar.google.com&color=%232952A3&src=ipkj749g67h89epofrv9p0u6d0%40group.calendar.google.com&color=%23691426&src=p5ej79pes2tvh726nm9nq9hq18%40group.calendar.google.com&color=%23B1440E&src=rl70382c737j9hs58vpba93gh8%40group.calendar.google.com&color=%235F6B02&src=hrmevents%40gmail.com&color=%238D6F47&src=app6upa4ffc9pb8abkachap288%40group.calendar.google.com&color=%23182C57&src=7lkspm0u8ku7oe5htfdi71sklg%40group.calendar.google.com&color=%2323164E&src=1vqddsm57v05s6t0s14vbugjqc%40group.calendar.google.com&color=%238D6F47&src=37870qc8aqd9mavck2b84rc7a4%40group.calendar.google.com&color=%23865A5A&src=recvanproject%40gmail.com&color=%231B887A&src=dajspdtgg3uhbo6hdjl1ekjbeg%40group.calendar.google.com&color=%2328754E&src=g3bfd4h4ngthv403cn2i0lktdc%40group.calendar.google.com&color=%232952A3&src=tatije54pe1od7h44434muu06s%40group.calendar.google.com&color=%23875509&src=78k92dn8i5h4hkghv11bsmlqgo%40group.calendar.google.com&color=%23AB8B00&src=qd2crcgvujt5jcock6aivr7he4%40group.calendar.google.com&color=%23853104&src=2568t0odfpavvip1tnqq4mhvpo%40group.calendar.google.com&color=%23691426&ctz=America%2FHalifax"
                style={{ border: 0 }}
                width="100%"
                height="467"
                title="Halifax Events Calendar"
              />
            </div>
            <p className="text-sm text-foreground/50 text-center">
              Data sourced from{' '}
              <a
                href="https://www.halifax.ca/home/events-calendar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-500 hover:underline"
              >
                HRM Events Calendar
              </a>
            </p>
          </div>
        </div>

        {/* ========== SCREEN 6: Reddit r/halifax ========== */}
        <div className="pt-[140px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
          <div className="max-w-5xl mx-auto px-2 mt-4">
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 dark:from-orange-900 dark:via-red-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Reddit</p>
                  <h2 className="text-3xl font-bold tracking-tight mt-1">r/halifax</h2>
                  <p className="text-base text-white/70 mt-1">
                    Top {redditPosts.length} hot posts{redditFetchedAt ? ` · updated ${timeAgo(Math.floor(new Date(redditFetchedAt).getTime() / 1000))}` : ''} ·{' '}
                    <a href="https://www.reddit.com/r/halifax" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                      reddit.com/r/halifax
                    </a>
                  </p>
                </div>
                <div className="text-5xl">🗣️</div>
              </div>
            </div>

            <div className="space-y-3 pb-16">
              {redditPosts.length === 0 ? (
                <div className="text-center py-16 text-foreground/40">
                  <p className="text-4xl mb-4">💬</p>
                  <p className="text-lg font-medium">Unable to load posts.</p>
                </div>
              ) : (
                redditPosts.map((post, index) => (
                  <a
                    key={index}
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-card rounded-xl border border-border hover:border-orange-400/40 shadow-sm hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {post.score > 0 && (
                          <div className="flex flex-col items-center min-w-[40px] text-center">
                            <span className="text-lg font-bold text-orange-500">▲</span>
                            <span className="text-sm font-bold text-foreground">{post.score}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {post.flair && (
                            <span className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded px-2 py-0.5 text-xs font-medium mb-1.5">
                              {post.flair}
                            </span>
                          )}
                          <p className="text-base font-semibold text-foreground leading-snug">{post.title}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-foreground/40">
                            {post.numComments > 0 && <span>💬 {post.numComments}</span>}
                            <span>u/{post.author}</span>
                            <span>{timeAgo(post.createdUtc)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollSnapContainer>
    </main>
  );
}