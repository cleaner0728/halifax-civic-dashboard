import BrandTitle from '@/components/BrandTitle';
import InstallButton from '@/components/InstallButton';
import MenuFab from '@/components/MenuFab';
import ScrollSnapContainer, { type TabSpec } from '@/components/ScrollSnapContainer';
import RefreshOnVisible from '@/components/RefreshOnVisible';
import CityLiveScreen from '@/components/screens/CityLiveScreen';
import FeedScreen from '@/components/screens/FeedScreen';
import EventsCalendarScreen from '@/components/screens/EventsCalendarScreen';
import StatsScreen from '@/components/screens/StatsScreen';
import { fetchWeather } from '@/lib/fetchers/weather';
import { fetchAirQuality } from '@/lib/fetchers/air-quality';
import { fetchBurnStatus } from '@/lib/fetchers/burn-status';
import { fetchAlerts } from '@/lib/fetchers/alerts';
import { fetchNews } from '@/lib/fetchers/news';
import { fetchHrmNews, fetchHrfeIncidents } from '@/lib/fetchers/hrm';
import {
  fetchTransitDetours,
  fetchFerryAlerts,
  fetchTransitAdjustments,
} from '@/lib/fetchers/transit';
import { fetchTides, computeTideGraph } from '@/lib/fetchers/tides';
import { fetchBuoy } from '@/lib/fetchers/buoy';
import { fetchMarineForecast } from '@/lib/fetchers/marine-forecast';
import { fetchRedditPosts } from '@/lib/fetchers/reddit';
import { fetchGasPrices } from '@/lib/fetchers/gas';
import { fetchGroceryPrices } from '@/lib/fetchers/grocery';
import { fetchEvents } from '@/lib/fetchers/events';
import { safe } from '@/lib/safe';

const TABS: TabSpec[] = [
  { label: 'City Live', icon: '🏙️' },
  { label: 'Feed', icon: '📰' },
  { label: 'Events', icon: '🎟️' },
  { label: 'Stats', icon: '📊' },
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
    hrmResult,
    hrfeIncidents,
    transitDetours,
    ferryAlerts,
    transitAdjustments,
    tides,
    redditData,
    gasPrices,
    airQuality,
    burnStatus,
    alerts,
    groceryPrices,
    buoy,
    marineForecast,
    events,
  ] = await Promise.all([
    safe(fetchWeather(), null, 'weather'),
    safe(fetchNews(), { items: [] }, 'news'),
    safe(fetchHrmNews(), { items: [], dateLabel: 'Error loading' }, 'hrm-news'),
    safe(fetchHrfeIncidents(), [], 'hrfe'),
    safe(fetchTransitDetours(), [], 'transit-detours'),
    safe(fetchFerryAlerts(), [], 'ferry-alerts'),
    safe(fetchTransitAdjustments(), null, 'transit-adjustments'),
    safe(fetchTides(), [], 'tides'),
    safe(fetchRedditPosts(), { posts: [], fetchedAt: null }, 'reddit'),
    safe(fetchGasPrices(), { history: [] }, 'gas-prices'),
    safe(fetchAirQuality(), null, 'air-quality'),
    safe(fetchBurnStatus(), null, 'burn-status'),
    safe(fetchAlerts(), [], 'alerts'),
    safe(fetchGroceryPrices(), { items: [] }, 'grocery-prices'),
    safe(fetchBuoy(), null, 'buoy'),
    safe(fetchMarineForecast(), null, 'marine-forecast'),
    safe(fetchEvents(), [], 'events'),
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

  return (
    <main className="bg-background text-foreground select-none [-webkit-user-select:none]">
      <RefreshOnVisible />
      <ScrollSnapContainer
        tabs={TABS}
        topBar={
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
            <BrandTitle />
            <div className="flex items-center gap-2 shrink-0">
              <InstallButton />
            </div>
          </div>
        }
      >
        <CityLiveScreen
          weather={weather}
          tideGraph={tideGraph}
          airQuality={airQuality}
          burnStatus={burnStatus}
          alerts={alerts}
          detours={transitDetours}
          ferryAlerts={ferryAlerts}
          adjustments={transitAdjustments}
          hrfeIncidents={hrfeIncidents}
          hrmNews={hrmResult.items}
          hrmDateLabel={hrmResult.dateLabel}
          buoy={buoy}
          marineForecast={marineForecast}
        />
        <FeedScreen
          news={news.items}
          redditPosts={redditData.posts}
          redditFetchedAt={redditData.fetchedAt}
        />
        <EventsCalendarScreen renderedAt={renderedAt} events={events} />
        <StatsScreen gasPrices={gasPrices} groceryPrices={groceryPrices} />
      </ScrollSnapContainer>
      <MenuFab />
    </main>
  );
}
