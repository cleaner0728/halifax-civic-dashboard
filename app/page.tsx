import ThemeToggle from '@/components/ThemeToggle';
import InstallButton from '@/components/InstallButton';
import ScrollSnapContainer from '@/components/ScrollSnapContainer';
import NewsAndWeatherScreen from '@/components/screens/NewsAndWeatherScreen';
import HrmNewsScreen from '@/components/screens/HrmNewsScreen';
import HrfeIncidentsScreen from '@/components/screens/HrfeIncidentsScreen';
import TransitDisruptionScreen from '@/components/screens/TransitDisruptionScreen';
import EventsCalendarScreen from '@/components/screens/EventsCalendarScreen';
import RedditScreen from '@/components/screens/RedditScreen';
import { fetchWeather } from '@/lib/fetchers/weather';
import { fetchAirQuality } from '@/lib/fetchers/air-quality';
import { fetchBurnStatus } from '@/lib/fetchers/burn-status';
import { fetchNews } from '@/lib/fetchers/news';
import { fetchHrmNews, fetchHrfeIncidents } from '@/lib/fetchers/hrm';
import { fetchTransitRss, fetchTransitDetours, fetchFerryAlerts } from '@/lib/fetchers/transit';
import { fetchTides, computeTideGraph } from '@/lib/fetchers/tides';
import { fetchRedditPosts } from '@/lib/fetchers/reddit';
import { safe } from '@/lib/safe';

const TAB_LABELS = [
  'News & Weather',
  'HRM News',
  'HRFE Incidents',
  'Transit Disruption',
  'Events Calendar',
  'r/halifax',
];

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
    tides,
    redditData,
    airQuality,
    burnStatus,
  ] = await Promise.all([
    safe(fetchWeather(), null, 'weather'),
    safe(fetchNews(), { items: [] }, 'news'),
    safe(fetchHrmNews(), { items: [], dateLabel: 'Error loading' }, 'hrm-news'),
    safe(fetchHrfeIncidents(), [], 'hrfe'),
    safe(fetchTransitDetours(), [], 'transit-detours'),
    safe(fetchFerryAlerts(), [], 'ferry-alerts'),
    safe(fetchTransitRss(), false, 'transit-rss'),
    safe(fetchTides(), [], 'tides'),
    safe(fetchRedditPosts(), { posts: [], fetchedAt: null }, 'reddit'),
    safe(fetchAirQuality(), null, 'air-quality'),
    safe(fetchBurnStatus(), null, 'burn-status'),
  ]);

  const tideGraph = computeTideGraph(tides);

  return (
    <main className="bg-background text-foreground">
      <ScrollSnapContainer
        labels={TAB_LABELS}
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
        <NewsAndWeatherScreen
          weather={weather}
          news={news}
          tideGraph={tideGraph}
          airQuality={airQuality}
          burnStatus={burnStatus}
        />
        <HrmNewsScreen items={hrmResult.items} dateLabel={hrmResult.dateLabel} />
        <HrfeIncidentsScreen incidents={hrfeIncidents} />
        <TransitDisruptionScreen detours={transitDetours} ferryAlerts={ferryAlerts} hasRecent={transitHasRecent} />
        <EventsCalendarScreen />
        <RedditScreen posts={redditData.posts} fetchedAt={redditData.fetchedAt} />
      </ScrollSnapContainer>
    </main>
  );
}
