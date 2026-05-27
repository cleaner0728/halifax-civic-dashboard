import HalifaxWebcams from '@/components/HalifaxWebcams';
import AlertsBlock from '@/components/blocks/AlertsBlock';
import WeatherBlock from '@/components/blocks/WeatherBlock';
import WindyMapBlock from '@/components/blocks/WindyMapBlock';
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
import type { BuoyObservation } from '@/lib/fetchers/buoy';
import type { MarineForecast } from '@/lib/fetchers/marine-forecast';

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
  buoy: BuoyObservation | null;
  marineForecast: MarineForecast | null;
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

// Section that folds its body behind its header. Default closed —
// keeps long, less-time-sensitive lists (city press releases, fire
// incidents) from pushing more urgent content off-screen on first
// load. Native <details>/<summary> for free a11y.
//
// Source link lives INSIDE the body, not in the summary row. Two
// reasons: (1) tapping a link inside <summary> would also toggle the
// section, requiring an onClick stopPropagation — which would force
// this whole file to become a client component. (2) The source link is
// contextual to the expanded content; showing it only when expanded
// keeps the collapsed header clean.
function CollapsibleSection({
  icon,
  title,
  meta,
  href,
  linkLabel,
  children,
}: {
  icon: string;
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-8">
      <summary
        className="list-none cursor-pointer flex items-center justify-between gap-3 mb-3 px-1 [&::-webkit-details-marker]:hidden"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl" aria-hidden>{icon}</span>
          <h2 className="text-lg font-bold text-foreground truncate">{title}</h2>
          {meta && <span className="text-xs text-foreground/40 truncate">· {meta}</span>}
        </div>
        <svg
          className="w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="space-y-3">
        {children}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-foreground/50 hover:text-foreground/80 px-1"
          >
            {linkLabel ?? 'source'} ↗
          </a>
        )}
      </div>
    </details>
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
  buoy,
  marineForecast,
}: Props) {
  return (
    <div className="pt-14 md:pt-24 pb-24 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-2">
        <AlertsBlock alerts={alerts} />

        <WindyMapBlock buoy={buoy} marineForecast={marineForecast} />

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

        <CollapsibleSection
          icon="🚒"
          title="Active Incidents"
          meta="past 90 min"
          href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
          linkLabel="HRFE feed"
        >
          <HrfeBlock incidents={hrfeIncidents} />
        </CollapsibleSection>

        <CollapsibleSection
          icon="🏛️"
          title="City News"
          meta={hrmDateLabel}
          href="https://www.halifax.ca/home/news"
          linkLabel="halifax.ca"
        >
          <HrmNewsBlock items={hrmNews} />
        </CollapsibleSection>
      </div>
    </div>
  );
}
