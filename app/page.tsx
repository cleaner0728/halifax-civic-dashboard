import Image from 'next/image';
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
import { fetchWeather } from '@/lib/fetchers/weather';
import { fetchAirQuality } from '@/lib/fetchers/air-quality';
import { fetchBurnStatus } from '@/lib/fetchers/burn-status';
import { fetchAlerts } from '@/lib/fetchers/alerts';
import { fetchNews } from '@/lib/fetchers/news';
import { fetchHrmNews, fetchHrfeIncidents } from '@/lib/fetchers/hrm';
import {
  fetchTransitRss,
  fetchTransitDetours,
  fetchFerryAlerts,
  fetchTransitAdjustments,
} from '@/lib/fetchers/transit';
import { fetchTides, computeTideGraph } from '@/lib/fetchers/tides';
import { fetchRedditPosts } from '@/lib/fetchers/reddit';
import { safe } from '@/lib/safe';

const TAB_LABELS = ['City Live', 'News', 'Reddit', 'HRM', 'HRFE', 'Transit', 'Events'];

export default async function Home() {
  // Each fetcher already returns an "empty" sentinel on failure; safe() catches
  // anything that still escapes so one bad source can't 500 the whole dashboard.
  const [
    weather,
    news,
    hrmResult,
    hrfeIncidents,
    transitDetours,
    ferryAlerts,
    transitHasRecent,
    transitAdjustments,
    tides,
    redditData,
    airQuality,
    burnStatus,
    alerts,
  ] = await Promise.all([
    safe(fetchWeather(), null, 'weather'),
    safe(fetchNews(), { items: [] }, 'news'),
    safe(fetchHrmNews(), { items: [], dateLabel: 'Error loading' }, 'hrm-news'),
    safe(fetchHrfeIncidents(), [], 'hrfe'),
    safe(fetchTransitDetours(), [], 'transit-detours'),
    safe(fetchFerryAlerts(), [], 'ferry-alerts'),
    safe(fetchTransitRss(), false, 'transit-rss'),
    safe(fetchTransitAdjustments(), null, 'transit-adjustments'),
    safe(fetchTides(), [], 'tides'),
    safe(fetchRedditPosts(), { posts: [], fetchedAt: null }, 'reddit'),
    safe(fetchAirQuality(), null, 'air-quality'),
    safe(fetchBurnStatus(), null, 'burn-status'),
    safe(fetchAlerts(), [], 'alerts'),
  ]);

  const tideGraph = computeTideGraph(tides);

  return (
    <main className="bg-background text-foreground">
      <RefreshOnVisible />
      <ScrollSnapContainer
        labels={TAB_LABELS}
        topBar={
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-2">
            <h1
              data-scroll-top
              className="flex items-center gap-2 text-base font-bold tracking-tight cursor-pointer select-none min-w-0"
              title="Double-click to return to the top"
            >
              <Image src="/logo.png" alt="" width={32} height={32} className="shrink-0" priority unoptimized />
              <span className="truncate">Halifax Today</span>
            </h1>
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
        />
        <NewsScreen items={news.items} />
        <RedditScreen posts={redditData.posts} fetchedAt={redditData.fetchedAt} />
        <HrmNewsScreen items={hrmResult.items} dateLabel={hrmResult.dateLabel} />
        <HrfeIncidentsScreen incidents={hrfeIncidents} />
        <TransitDisruptionScreen
          detours={transitDetours}
          ferryAlerts={ferryAlerts}
          hasRecent={transitHasRecent}
          adjustments={transitAdjustments}
        />
        <EventsCalendarScreen />
      </ScrollSnapContainer>
    </main>
  );
}
