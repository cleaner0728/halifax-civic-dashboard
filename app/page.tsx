import BrandTitle from '@/components/BrandTitle';
import InstallButton from '@/components/InstallButton';
import LanguageToggle from '@/components/LanguageToggle';
import SettingsMenu from '@/components/SettingsMenu';
import ScrollSnapContainer from '@/components/ScrollSnapContainer';
import RefreshOnVisible from '@/components/RefreshOnVisible';
import WeatherScreen from '@/components/screens/WeatherScreen';
import NewsScreen from '@/components/screens/NewsScreen';
import HrmNewsScreen from '@/components/screens/HrmNewsScreen';
import HrfeIncidentsScreen from '@/components/screens/HrfeIncidentsScreen';
import TransitDisruptionScreen from '@/components/screens/TransitDisruptionScreen';
import EventsCalendarScreen from '@/components/screens/EventsCalendarScreen';
import RedditScreen from '@/components/screens/RedditScreen';
import GroceryScreen from '@/components/screens/GroceryScreen';
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
import { fetchRedditPosts } from '@/lib/fetchers/reddit';
import { fetchGasPrices } from '@/lib/fetchers/gas';
import { fetchGroceryPrices } from '@/lib/fetchers/grocery';
import { safe } from '@/lib/safe';

const TAB_LABELS = ['City Live', 'Reddit', 'News', 'Transit', 'HRM', 'HRFE', 'Events', 'Prices'];

export default async function Home() {
  // Captured here so the same value flows to anything that displays "data
  // freshness". Resolves at the moment the RSC tree is computed; RSC cache
  // hits will reuse this older value, which is what we want — a cached
  // render genuinely IS older data.
  const renderedAt = Date.now();

  // Each fetcher already returns an "empty" sentinel on failure; safe() catches
  // anything that still escapes so one bad source can't 500 the whole dashboard.
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
  ]);

  const tideGraph = computeTideGraph(tides);

  return (
    <main className="bg-background text-foreground select-none [-webkit-user-select:none]">
      <RefreshOnVisible />
      <ScrollSnapContainer
        labels={TAB_LABELS}
        topBar={
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
            <BrandTitle />
            <div className="flex items-center gap-2 shrink-0">
              <InstallButton />
              <LanguageToggle />
              <SettingsMenu />
            </div>
          </div>
        }
      >
        <WeatherScreen
          weather={weather}
          tideGraph={tideGraph}
          airQuality={airQuality}
          burnStatus={burnStatus}
          alerts={alerts}
          gasPrices={gasPrices}
        />
        <RedditScreen posts={redditData.posts} fetchedAt={redditData.fetchedAt} />
        <NewsScreen items={news.items} />
        <TransitDisruptionScreen
          detours={transitDetours}
          ferryAlerts={ferryAlerts}
          adjustments={transitAdjustments}
        />
        <HrmNewsScreen items={hrmResult.items} dateLabel={hrmResult.dateLabel} />
        <HrfeIncidentsScreen incidents={hrfeIncidents} />
        <EventsCalendarScreen renderedAt={renderedAt} />
        <GroceryScreen groceryPrices={groceryPrices} />
      </ScrollSnapContainer>
    </main>
  );
}
