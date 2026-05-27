import HalifaxWebcams from '@/components/HalifaxWebcams';
import AlertsBlock from '@/components/blocks/AlertsBlock';
import WeatherBlock from '@/components/blocks/WeatherBlock';
import GettingAroundBlock from '@/components/blocks/GettingAroundBlock';
import HrfeBlock from '@/components/blocks/HrfeBlock';
import HrmNewsBlock from '@/components/blocks/HrmNewsBlock';
import type { WeatherData } from '@/lib/fetchers/weather';
import type { TideGraphData } from '@/lib/fetchers/tides';
import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';
import type { WeatherAlert } from '@/lib/fetchers/alerts';
import type { HrmItem } from '@/lib/fetchers/hrm';
import type { TransitDetour, FerryAlert, TransitAdjustment } from '@/lib/fetchers/transit';

type Props = {
  weather: WeatherData | null;
  tideGraph: TideGraphData | null;
  airQuality: AirQuality | null;
  burnStatus: BurnStatus | null;
  alerts: WeatherAlert[];
  detours: TransitDetour[];
  ferryAlerts: FerryAlert[];
  adjustments: TransitAdjustment | null;
  hrfeIncidents: HrmItem[];
  hrmNews: HrmItem[];
  hrmDateLabel: string;
};

function SectionHeader({
  icon,
  title,
  meta,
  href,
  linkLabel,
}: {
  icon: string;
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-8 mb-3 px-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xl" aria-hidden>{icon}</span>
        <h2 className="text-lg font-bold text-foreground truncate">{title}</h2>
        {meta && <span className="text-xs text-foreground/40 truncate">· {meta}</span>}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-foreground/50 hover:text-foreground/80 whitespace-nowrap"
        >
          {linkLabel ?? 'source'} ↗
        </a>
      )}
    </div>
  );
}

export default function CityLiveScreen({
  weather,
  tideGraph,
  airQuality,
  burnStatus,
  alerts,
  detours,
  ferryAlerts,
  adjustments,
  hrfeIncidents,
  hrmNews,
  hrmDateLabel,
}: Props) {
  return (
    <div className="pt-20 pb-24 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <AlertsBlock alerts={alerts} />

        {/* Right Now — weather card already packs tides, AQ, burn, UV, etc.
            into its own grid. Webcams sit directly under per spec. */}
        <WeatherBlock
          weather={weather}
          tideGraph={tideGraph}
          airQuality={airQuality}
          burnStatus={burnStatus}
        />
        <HalifaxWebcams />

        <SectionHeader
          icon="🚌"
          title="Getting Around"
          href="https://www.halifax.ca/transportation/halifax-transit/service-disruptions"
          linkLabel="halifax.ca"
        />
        <GettingAroundBlock
          detours={detours}
          ferryAlerts={ferryAlerts}
          adjustments={adjustments}
        />

        <SectionHeader
          icon="🚒"
          title="Active Incidents"
          meta="past 90 min"
          href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
          linkLabel="HRFE feed"
        />
        <HrfeBlock incidents={hrfeIncidents} />

        <SectionHeader
          icon="🏛️"
          title="City News"
          meta={hrmDateLabel}
          href="https://www.halifax.ca/home/news"
          linkLabel="halifax.ca"
        />
        <HrmNewsBlock items={hrmNews} />
      </div>
    </div>
  );
}
