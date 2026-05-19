import Parser from 'rss-parser';
import { parse as parseHtml } from 'node-html-parser';
import ThemeToggle from '@/components/ThemeToggle';
import ScrollSnapContainer from '@/components/ScrollSnapContainer';
import LiveClock from '@/components/LiveClock';

// ============ Types ============

type CustomFeed = {};
type CustomItem = {
  'media:thumbnail'?: { $: { url: string } };
  'media:content'?: { $: { url: string; medium?: string } } | Array<{ $: { url: string; medium?: string } }>;
  enclosure?: { url: string; type?: string };
  content?: string;
};

type NewsItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
  imageUrl?: string;
  source?: string;
};

type HrmItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
};

type TidePoint = { time: string; value: number };

type TideGraphData = {
  fillPoints: string;
  linePoints: string;
  nowX: number;
  currentLevel: number;
  nextHigh: TidePoint | null;
  nextLow: TidePoint | null;
  nextHighX: number;
  nextHighY: number;
  nextLowX: number;
  nextLowY: number;
};

type TransitDetour = {
  title: string;
  routes: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  time?: string;
  location?: string;
  summary?: string;
};

// ============ Weather Types & Helpers ============

interface WeatherData {
  temperature: number;
  apparentTemp: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
  isDay: boolean;
  daily: {
    date: string;
    weatherCode: number;
    maxTemp: number;
    minTemp: number;
    sunrise: string;
    sunset: string;
  }[];
}

type WeatherTheme = {
  container: string;
  textPrimary: string;
  textSecondary: string;
  bottomBar: string;
};

const weatherThemes = {
  clearDay: {
    container: 'bg-gradient-to-br from-sky-300 via-blue-400 to-blue-500',
    textPrimary: 'text-white',
    textSecondary: 'text-white/80',
    bottomBar: 'bg-black/10',
  },
  clearNight: {
    container: 'bg-gradient-to-br from-indigo-950 via-slate-900 to-black',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
  cloudyDay: {
    container: 'bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600',
    textPrimary: 'text-white',
    textSecondary: 'text-white/80',
    bottomBar: 'bg-black/15',
  },
  cloudyNight: {
    container: 'bg-gradient-to-br from-slate-800 via-slate-900 to-black',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
  rainDay: {
    container: 'bg-gradient-to-br from-slate-500 via-blue-600 to-slate-700',
    textPrimary: 'text-white',
    textSecondary: 'text-white/80',
    bottomBar: 'bg-black/20',
  },
  rainNight: {
    container: 'bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
  snowDay: {
    container: 'bg-gradient-to-br from-sky-100 via-slate-200 to-slate-300',
    textPrimary: 'text-slate-800',
    textSecondary: 'text-slate-600',
    bottomBar: 'bg-white/40',
  },
  snowNight: {
    container: 'bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900',
    textPrimary: 'text-white',
    textSecondary: 'text-white/70',
    bottomBar: 'bg-white/10',
  },
};

function getWeatherInfo(code: number, isNight: boolean = false): { emoji: string; label: string; theme: WeatherTheme } {
  let category: 'clear' | 'cloudy' | 'rain' | 'snow' = 'clear';
  if ([0, 1].includes(code)) category = 'clear';
  else if ([2, 3, 45, 48].includes(code)) category = 'cloudy';
  else if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code)) category = 'rain';
  else if ([71, 73, 75, 77, 85, 86].includes(code)) category = 'snow';

  const themeKey = `${category}${isNight ? 'Night' : 'Day'}` as keyof typeof weatherThemes;
  const theme = weatherThemes[themeKey] || weatherThemes.clearDay;

  const map: Record<number, { day: string; night: string; label: string }> = {
    0: { day: '☀️', night: '🌙', label: 'Clear sky' },
    1: { day: '🌤️', night: '🌙', label: 'Mainly clear' },
    2: { day: '⛅', night: '☁️', label: 'Partly cloudy' },
    3: { day: '☁️', night: '☁️', label: 'Overcast' },
    45: { day: '🌫️', night: '🌫️', label: 'Fog' },
    48: { day: '🌫️', night: '🌫️', label: 'Rime fog' },
    51: { day: '🌦️', night: '🌧️', label: 'Light drizzle' },
    53: { day: '🌦️', night: '🌧️', label: 'Drizzle' },
    55: { day: '🌧️', night: '🌧️', label: 'Heavy drizzle' },
    61: { day: '🌧️', night: '🌧️', label: 'Light rain' },
    63: { day: '🌧️', night: '🌧️', label: 'Rain' },
    65: { day: '🌧️', night: '🌧️', label: 'Heavy rain' },
    71: { day: '🌨️', night: '🌨️', label: 'Light snow' },
    73: { day: '🌨️', night: '🌨️', label: 'Snow' },
    75: { day: '❄️', night: '❄️', label: 'Heavy snow' },
    77: { day: '🌨️', night: '🌨️', label: 'Snow grains' },
    80: { day: '🌦️', night: '🌧️', label: 'Rain showers' },
    81: { day: '🌧️', night: '🌧️', label: 'Heavy showers' },
    82: { day: '⛈️', night: '⛈️', label: 'Violent showers' },
    85: { day: '🌨️', night: '🌨️', label: 'Snow showers' },
    86: { day: '❄️', night: '❄️', label: 'Heavy snow showers' },
    95: { day: '⛈️', night: '⛈️', label: 'Thunderstorm' },
    96: { day: '⛈️', night: '⛈️', label: 'Thunderstorm + hail' },
    99: { day: '⛈️', night: '⛈️', label: 'Thunderstorm + heavy hail' },
  };
  const info = map[code] || { day: '🌡️', night: '🌡️', label: 'Unknown' };
  return { emoji: isNight ? info.night : info.day, label: info.label, theme };
}

function getDayName(dateStr: string): string {
  const now = new Date();
  const todayStr = toHfxDateStr(now);
  const tomorrowStr = toHfxDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'TMR';
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: HFX_TZ });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ============ Image Helpers ============

function getImageUrl(item: CustomItem & { enclosure?: { url: string; type?: string } }): string | undefined {
  if (item['media:thumbnail']?.$?.url) {
    return item['media:thumbnail'].$.url;
  }
  const mediaContent = item['media:content'];
  if (Array.isArray(mediaContent)) {
    const imageMedia = mediaContent.find(m => m.$?.url && (!m.$?.medium || m.$?.medium === 'image'));
    if (imageMedia?.$?.url) return imageMedia.$.url;
  } else if (mediaContent?.$?.url) {
    return mediaContent.$.url;
  }
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }
  if (item.content) {
    const match = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

// ============ Date helpers ============

const HFX_TZ = 'America/Halifax';

function toHfxDateStr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', { timeZone: HFX_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function isSameDay(dateStr: string, target: Date): boolean {
  return toHfxDateStr(dateStr) === toHfxDateStr(target);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').trim();
}

// ============ Transit Helpers ============

function extractStrongField(html: string, labelPattern: string): string {
  const regex = new RegExp(`<strong>\\s*${labelPattern}\\s*<\\/strong>([^<]*)`, 'i');
  const m = html.match(regex);
  return m ? m[1].trim() : '';
}

function extractDetourSummary(html: string): string {
  const hrIdx = html.indexOf('<hr>');
  if (hrIdx === -1) return '';
  const afterHr = html.slice(hrIdx + 4);
  const tabsIdx = afterHr.indexOf('<div class="bootstrap-tabs">');
  const portion = tabsIdx !== -1 ? afterHr.slice(0, tabsIdx) : afterHr;
  return portion
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s*Buses will detour as follows:\s*$/i, '')
    .trim();
}

// ============ Data Fetching ============

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=44.65&longitude=-63.57&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=America/Halifax&forecast_days=5',
      { next: { revalidate: 900 } }
    );
    const data = await res.json();
    return {
      temperature: data.current.temperature_2m,
      apparentTemp: data.current.apparent_temperature,
      weatherCode: data.current.weather_code,
      windSpeed: data.current.wind_speed_10m,
      humidity: data.current.relative_humidity_2m,
      isDay: data.current.is_day === 1,
      daily: data.daily.time.map((t: string, i: number) => ({
        date: t,
        weatherCode: data.daily.weather_code[i],
        maxTemp: data.daily.temperature_2m_max[i],
        minTemp: data.daily.temperature_2m_min[i],
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
      })),
    };
  } catch (e) {
    console.error('Failed to fetch weather:', e);
    return null;
  }
}

async function fetchNews(): Promise<{ items: NewsItem[] }> {
  const parser = new Parser<CustomFeed, CustomItem>({
    customFields: {
      item: [
        ['media:thumbnail', 'media:thumbnail', { keepArray: false }],
        ['media:content', 'media:content', { keepArray: true }],
      ],
    },
  });

  const sources = [
    { url: 'https://www.cbc.ca/webfeed/rss/rss-canada-novascotia', name: 'CBC Nova Scotia' },
    { url: 'https://halifaxexaminer.ca/feed/', name: 'Halifax Examiner' },
    { url: 'https://globalnews.ca/halifax/feed/', name: 'Global News Halifax' },
  ];

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const allItems: NewsItem[] = [];
  await Promise.allSettled(
    sources.map(async ({ url, name }) => {
      const feed = await parser.parseURL(url);
      for (const item of feed.items || []) {
        const d = item.pubDate || item.isoDate;
        if (!d || new Date(d) <= cutoff) continue;
        allItems.push({
          title: item.title,
          link: item.link,
          pubDate: d,
          contentSnippet: item.contentSnippet,
          imageUrl: getImageUrl(item),
          source: name,
        });
      }
    })
  );

  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return { items: allItems };
}

async function fetchHrmNews(): Promise<{ items: HrmItem[]; dateLabel: string }> {
  const parser = new Parser();
  console.log(`[Fetch] HRM News RSS at ${new Date().toLocaleTimeString()}`);
  try {
    const feed = await parser.parseURL('https://www.halifax.ca/news/rss-feed');
    const allItems = feed.items || [];

    // Try today first, then go back day by day until we find content (up to 14 days)
    const today = new Date();
    for (let daysBack = 0; daysBack < 14; daysBack++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - daysBack);

      const matchingItems = allItems.filter(item => {
        const pubDate = item.pubDate || item.isoDate;
        return pubDate ? isSameDay(pubDate, targetDate) : false;
      });

      if (matchingItems.length > 0) {
        const dateLabel = targetDate.toLocaleDateString('en-US', { timeZone: HFX_TZ, weekday: 'long', month: 'long', day: 'numeric' });

        return {
          dateLabel,
          items: matchingItems.map(item => ({
            title: item.title?.trim(),
            link: item.link,
            pubDate: item.pubDate || item.isoDate,
            description: item.contentSnippet || (item.content ? stripHtml(item.content) : ''),
          })),
        };
      }
    }

    return { items: [], dateLabel: 'No recent updates' };
  } catch (e) {
    console.error('Failed to fetch HRM news:', e);
    return { items: [], dateLabel: 'Error loading' };
  }
}

async function fetchHrfeIncidents(): Promise<HrmItem[]> {
  const parser = new Parser();
  console.log(`[Fetch] HRFE Incidents RSS at ${new Date().toLocaleTimeString()}`);
  try {
    const feed = await parser.parseURL('https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed/rss.xml');
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
    return (feed.items || [])
      .filter(item => {
        const d = item.pubDate || item.isoDate;
        return d ? new Date(d) > cutoff : false;
      })
      .map(item => ({
        title: item.title?.trim(),
        link: item.link,
        pubDate: item.pubDate || item.isoDate,
        description: item.contentSnippet || (item.content ? stripHtml(item.content) : ''),
      }));
  } catch (e) {
    console.error('Failed to fetch HRFE incidents:', e);
    return [];
  }
}

async function fetchTransitRss(): Promise<boolean> {
  try {
    const parser = new Parser();
    const feed = await parser.parseURL('https://www.halifax.ca/page-published-feed/15879');
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    return (feed.items || []).some(item => {
      const d = item.pubDate || item.isoDate;
      return d ? new Date(d) > cutoff : false;
    });
  } catch {
    return false;
  }
}

async function fetchTransitDetours(): Promise<TransitDetour[]> {
  try {
    const res = await fetch(
      'https://www.halifax.ca/transportation/halifax-transit/service-disruptions',
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return [];
    const html = await res.text();

    const detourStart = html.indexOf('<h2>Detours</h2>');
    if (detourStart === -1) return [];
    const stopStart = html.indexOf('<h2>Stop Closures</h2>');
    const section = stopStart !== -1 ? html.slice(detourStart, stopStart) : html.slice(detourStart);

    const root = parseHtml(section);
    const results: TransitDetour[] = [];
    for (const accordion of root.querySelectorAll('.paragraph--type--accordion')) {
      const contentDiv = accordion.querySelector('.u-text-lighter');
      if (!contentDiv) continue;
      const inner = contentDiv.innerHTML;
      const title = contentDiv.querySelector('h3')?.text.trim() ?? '';
      if (!title) continue;
      results.push({
        title,
        routes: extractStrongField(inner, 'Route(?:\\(s\\)|s)?:'),
        date: extractStrongField(inner, 'Date:') || undefined,
        startDate: extractStrongField(inner, 'Start Date:') || undefined,
        endDate: extractStrongField(inner, 'End Date:') || undefined,
        time: extractStrongField(inner, 'Time:') || undefined,
        location: extractStrongField(inner, 'Location:') || undefined,
        summary: extractDetourSummary(inner) || undefined,
      });
    }
    return results;
  } catch (e) {
    console.error('Failed to fetch transit disruptions:', e);
    return [];
  }
}

async function fetchTides(): Promise<TidePoint[]> {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z';
    const to = new Date(now.getTime() + 21 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z';
    const url = `https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/5cebf1df3d0f4a073c4bbcbb/data?time-series-code=wlp&from=${from}&to=${to}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json() as Array<{ eventDate: string; value: number }>;
    // API returns 1-minute resolution; downsample to ~10-minute steps to keep the SVG light.
    return data
      .filter((_, i) => i % 10 === 0)
      .map(d => ({ time: d.eventDate, value: d.value }));
  } catch {
    return [];
  }
}

function computeTideGraph(tides: TidePoint[]): TideGraphData | null {
  if (tides.length < 2) return null;
  const W = 800, H = 72, PAD = 4;
  const values = tides.map(t => t.value);
  const times = tides.map(t => new Date(t.time).getTime());
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeRange = maxTime - minTime || 1;
  const now = Date.now();

  const tx = (t: number) => PAD + ((t - minTime) / timeRange) * (W - 2 * PAD);
  const vy = (v: number) => H - PAD - ((v - minVal) / range) * (H - 2 * PAD);

  const pts = tides.map((t, i) => `${tx(times[i]).toFixed(1)},${vy(t.value).toFixed(1)}`).join(' ');

  let closestIdx = 0;
  let closestDiff = Infinity;
  times.forEach((t, i) => { const d = Math.abs(t - now); if (d < closestDiff) { closestDiff = d; closestIdx = i; } });

  let nextHigh: TidePoint | null = null;
  let nextLow: TidePoint | null = null;
  let nextHighX = 0, nextHighY = 0, nextLowX = 0, nextLowY = 0;
  for (let i = 1; i < tides.length - 1; i++) {
    if (times[i] <= now) continue;
    if (!nextHigh && tides[i].value > tides[i - 1].value && tides[i].value > tides[i + 1].value) {
      nextHigh = tides[i]; nextHighX = tx(times[i]); nextHighY = vy(tides[i].value);
    }
    if (!nextLow && tides[i].value < tides[i - 1].value && tides[i].value < tides[i + 1].value) {
      nextLow = tides[i]; nextLowX = tx(times[i]); nextLowY = vy(tides[i].value);
    }
    if (nextHigh && nextLow) break;
  }

  return {
    fillPoints: `${PAD},${H} ${pts} ${W - PAD},${H}`,
    linePoints: pts,
    nowX: Math.max(PAD, Math.min(W - PAD, tx(now))),
    currentLevel: tides[closestIdx]?.value ?? 0,
    nextHigh, nextLow,
    nextHighX, nextHighY, nextLowX, nextLowY,
  };
}

// ============ Page Component ============

export default async function Home() {
  const [weather, news, hrmResult, hrfeIncidents, transitDetours, transitHasRecent, tides] = await Promise.all([
    fetchWeather(),
    fetchNews(),
    fetchHrmNews(),
    fetchHrfeIncidents(),
    fetchTransitDetours(),
    fetchTransitRss(),
    fetchTides(),
  ]);

  const currentWeather = weather ? getWeatherInfo(weather.weatherCode, !weather.isDay) : null;
  const hrmNews = hrmResult.items;
  const hrmDateLabel = hrmResult.dateLabel;
  const tideGraph = computeTideGraph(tides);

  return (
    <main className="bg-background text-foreground">
      <ScrollSnapContainer 
        labels={["News & Weather", "HRM News", "HRFE Incidents", "Transit Disruption", "Events Calendar"]}
        topBar={
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold tracking-tight">📰 Halifax Dashboard</h1>
            <ThemeToggle />
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

        {/* SCREEN 6: Reddit r/halifax — pending API approval, restore when OAuth is approved */}
      </ScrollSnapContainer>
    </main>
  );
}