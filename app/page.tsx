import BrandTitle from '@/components/BrandTitle';
import InstallButton from '@/components/InstallButton';
import SettingsMenu from '@/components/SettingsMenu';
import ScrollSnapContainer, { type TabSpec } from '@/components/ScrollSnapContainer';
import RefreshOnVisible from '@/components/RefreshOnVisible';
import ViewportGate from '@/components/ViewportGate';
import type { DashboardData } from '@/components/desktop/DesktopShell';
import CityLiveScreen from '@/components/screens/CityLiveScreen';
import FeedScreen from '@/components/screens/FeedScreen';
import EventsCalendarScreen from '@/components/screens/EventsCalendarScreen';
import StatsScreen from '@/components/screens/StatsScreen';
import { fetchWeather } from '@/lib/fetchers/weather';
import { fetchAirQuality } from '@/lib/fetchers/air-quality';
import { fetchBurnStatus } from '@/lib/fetchers/burn-status';
import { fetchAlerts } from '@/lib/fetchers/alerts';
import { fetchNews } from '@/lib/fetchers/news';
import {
  resolveFerry,
  resolveTransit,
  resolveIncidents,
  resolveHrmNews,
} from '@/lib/fetchers/civic-feed';
import { fetchTides, computeTideGraph } from '@/lib/fetchers/tides';
import { fetchBuoy } from '@/lib/fetchers/buoy';
import { fetchMarineForecast } from '@/lib/fetchers/marine-forecast';
import { fetchRedditPosts } from '@/lib/fetchers/reddit';
import { fetchRedditVoices } from '@/lib/fetchers/reddit-voices';
import { fetchGasPrices } from '@/lib/fetchers/gas';
import { fetchGroceryPrices } from '@/lib/fetchers/grocery';
import { fetchEvents } from '@/lib/fetchers/events';
import { fetchWinterParkingBan } from '@/lib/fetchers/winter-parking';
import { safe } from '@/lib/safe';

const TABS: TabSpec[] = [
  { label: 'Pulse', icon: 'pulse' },
  { label: 'City Live', icon: 'city' },
  { label: 'Events', icon: 'events' },
  { label: 'Stats', icon: 'stats' },
];

export default async function Home() {
  // Server components render once per request, so capturing wall-clock render
  // time here is intentional and deterministic for this response — it drives
  // the "refreshed X ago" footer label.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();

  const [
    weather,
    news,
    hrm,
    incidents,
    transit,
    ferry,
    tides,
    redditData,
    redditVoices,
    gasPrices,
    airQuality,
    burnStatus,
    alerts,
    groceryPrices,
    buoy,
    marineForecast,
    events,
    winterParkingBan,
  ] = await Promise.all([
    safe(fetchWeather(), null, 'weather'),
    safe(fetchNews(), { items: [] }, 'news'),
    safe(resolveHrmNews(), { items: [], dateLabel: 'Error loading', hasUpdateToday: false }, 'hrm-news'),
    safe(resolveIncidents(), { incidents: [], hasUpdateToday: false }, 'incidents'),
    safe(resolveTransit(), { detours: [], adjustments: null, hasUpdateToday: false }, 'transit'),
    safe(resolveFerry(), { alerts: [], hasUpdateToday: false }, 'ferry'),
    safe(fetchTides(), [], 'tides'),
    safe(fetchRedditPosts(), { posts: [], fetchedAt: null, source: 'rss' as const }, 'reddit'),
    safe(fetchRedditVoices(), [], 'reddit-voices'),
    safe(fetchGasPrices(), { history: [] }, 'gas-prices'),
    safe(fetchAirQuality(), null, 'air-quality'),
    safe(fetchBurnStatus(), null, 'burn-status'),
    safe(fetchAlerts(), [], 'alerts'),
    safe(fetchGroceryPrices(), { items: [] }, 'grocery-prices'),
    safe(fetchBuoy(), null, 'buoy'),
    safe(fetchMarineForecast(), null, 'marine-forecast'),
    safe(fetchEvents(), [], 'events'),
    safe(fetchWinterParkingBan(), null, 'winter-parking'),
  ]);

  // computeTideGraph is pure but defensive: malformed tide data shouldn't be
  // able to 500 the whole page. Returns null on bad input (same as its normal
  // "not enough points" fallback), which CityLiveScreen already handles.
  let tideGraph: ReturnType<typeof computeTideGraph> = null;
  try {
    tideGraph = computeTideGraph(tides);
  } catch (e) {
    console.error('[page] computeTideGraph threw:', e);
  }

  // Single source of truth for both trees. The mobile ScrollSnapContainer and
  // the desktop dashboard consume the same already-fetched data — no second
  // request, and the desktop board can never drift from the mobile screens.
  const data: DashboardData = {
    weather,
    tideGraph,
    airQuality,
    burnStatus,
    alerts,
    detours: transit.detours,
    ferryAlerts: ferry.alerts,
    adjustments: transit.adjustments,
    hrfeIncidents: incidents.incidents,
    hrmNews: hrm.items,
    hrmDateLabel: hrm.dateLabel,
    ferryHasUpdate: ferry.hasUpdateToday,
    transitHasUpdate: transit.hasUpdateToday,
    incidentsHasUpdate: incidents.hasUpdateToday,
    hrmNewsHasUpdate: hrm.hasUpdateToday,
    buoy,
    marineForecast,
    winterParkingBan,
    news: news.items,
    redditPosts: redditData.posts,
    redditFetchedAt: redditData.fetchedAt,
    redditVoices,
    events,
    gasPrices,
    groceryPrices,
    renderedAt,
  };

  return (
    <main className="bg-background text-foreground select-none [-webkit-user-select:none]">
      <RefreshOnVisible />
      {/* ViewportGate renders the mobile tree below 1280px (unchanged) or the
          desktop dashboard at/above it. The mobile JSX here is identical to
          before — it's just been moved into the `mobile` slot. */}
      <ViewportGate
        data={data}
        mobile={
          <ScrollSnapContainer
            tabs={TABS}
            topBar={
              <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
                <BrandTitle />
                <div className="flex items-center gap-2 shrink-0">
                  <InstallButton />
                  <SettingsMenu />
                </div>
              </div>
            }
          >
            <FeedScreen
              news={news.items}
              redditPosts={redditData.posts}
              redditFetchedAt={redditData.fetchedAt}
            />
            <CityLiveScreen
              weather={weather}
              tideGraph={tideGraph}
              airQuality={airQuality}
              burnStatus={burnStatus}
              alerts={alerts}
              detours={transit.detours}
              ferryAlerts={ferry.alerts}
              adjustments={transit.adjustments}
              hrfeIncidents={incidents.incidents}
              hrmNews={hrm.items}
              hrmDateLabel={hrm.dateLabel}
              ferryHasUpdate={ferry.hasUpdateToday}
              transitHasUpdate={transit.hasUpdateToday}
              incidentsHasUpdate={incidents.hasUpdateToday}
              hrmNewsHasUpdate={hrm.hasUpdateToday}
              buoy={buoy}
              marineForecast={marineForecast}
              winterParkingBan={winterParkingBan}
            />
            <EventsCalendarScreen renderedAt={renderedAt} events={events} />
            <StatsScreen gasPrices={gasPrices} groceryPrices={groceryPrices} />
          </ScrollSnapContainer>
        }
      />
    </main>
  );
}
