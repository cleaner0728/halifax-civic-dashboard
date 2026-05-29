import HalifaxWebcams from '@/components/HalifaxWebcams';
import AlertsBlock from '@/components/blocks/AlertsBlock';
import WeatherBlock from '@/components/blocks/WeatherBlock';
import WindyMapBlock from '@/components/blocks/WindyMapBlock';
import GettingAroundBlock from '@/components/blocks/GettingAroundBlock';
import HrfeBlock from '@/components/blocks/HrfeBlock';
import HrmNewsBlock from '@/components/blocks/HrmNewsBlock';
import { IconCloudSun, IconFerry, IconBus, IconFlame, IconLandmark, IconCalendar } from '@/components/icons';
import type { WeatherData } from '@/lib/fetchers/weather';
import type { TideGraphData } from '@/lib/fetchers/tides';
import type { AirQuality } from '@/lib/fetchers/air-quality';
import type { BurnStatus } from '@/lib/fetchers/burn-status';
import type { WeatherAlert } from '@/lib/fetchers/alerts';
import type { HrmItem } from '@/lib/fetchers/hrm';
import type { TransitDetour, FerryAlert, TransitAdjustment } from '@/lib/fetchers/transit';
import type { BuoyObservation } from '@/lib/fetchers/buoy';
import type { MarineForecast } from '@/lib/fetchers/marine-forecast';

// HRM's aggregated Google Calendar (community + municipal feeds), Halifax tz.
const HRM_CALENDAR_SRC =
  'https://calendar.google.com/calendar/embed?showTitle=0&mode=AGENDA&height=600&wkst=1&bgcolor=%23FFFFFF' +
  '&src=dd2f3gg1q7g2sodi34c479jqmk%40group.calendar.google.com&color=%232952A3' +
  '&src=ipkj749g67h89epofrv9p0u6d0%40group.calendar.google.com&color=%23691426' +
  '&src=p5ej79pes2tvh726nm9nq9hq18%40group.calendar.google.com&color=%23B1440E' +
  '&src=rl70382c737j9hs58vpba93gh8%40group.calendar.google.com&color=%235F6B02' +
  '&src=hrmevents%40gmail.com&color=%238D6F47' +
  '&src=app6upa4ffc9pb8abkachap288%40group.calendar.google.com&color=%23182C57' +
  '&src=7lkspm0u8ku7oe5htfdi71sklg%40group.calendar.google.com&color=%2323164E' +
  '&src=1vqddsm57v05s6t0s14vbugjqc%40group.calendar.google.com&color=%238D6F47' +
  '&src=37870qc8aqd9mavck2b84rc7a4%40group.calendar.google.com&color=%23865A5A' +
  '&src=recvanproject%40gmail.com&color=%231B887A' +
  '&src=dajspdtgg3uhbo6hdjl1ekjbeg%40group.calendar.google.com&color=%2328754E' +
  '&src=g3bfd4h4ngthv403cn2i0lktdc%40group.calendar.google.com&color=%232952A3' +
  '&src=tatije54pe1od7h44434muu06s%40group.calendar.google.com&color=%23875509' +
  '&src=78k92dn8i5h4hkghv11bsmlqgo%40group.calendar.google.com&color=%23AB8B00' +
  '&src=qd2crcgvujt5jcock6aivr7he4%40group.calendar.google.com&color=%23853104' +
  '&src=2568t0odfpavvip1tnqq4mhvpo%40group.calendar.google.com&color=%23691426' +
  '&ctz=America%2FHalifax';

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
  icon: React.ReactNode;
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
          <span className="text-foreground/55 shrink-0">{icon}</span>
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

        <HalifaxWebcams />

        <CollapsibleSection
          icon={<IconCloudSun className="w-5 h-5" />}
          title="Weather & Marine"
          meta="Halifax"
        >
          <WeatherBlock
            weather={weather}
            tideGraph={tideGraph}
            airQuality={airQuality}
            burnStatus={burnStatus}
          />
          <WindyMapBlock headless buoy={buoy} marineForecast={marineForecast} />
        </CollapsibleSection>

        <CollapsibleSection
          icon={<IconFerry className="w-5 h-5" />}
          title="Ferry"
          href="https://www.halifax.ca/transportation/halifax-transit/service-disruptions"
          linkLabel="halifax.ca"
        >
          <GettingAroundBlock
            detours={[]}
            ferryAlerts={ferryAlerts}
            adjustments={null}
            emptyMessage="No active ferry alerts."
            emptySubMessage="Alderney and Woodside ferries running on regular schedule."
          />
        </CollapsibleSection>

        <CollapsibleSection
          icon={<IconBus className="w-5 h-5" />}
          title="Transit"
          href="https://www.halifax.ca/transportation/halifax-transit/service-disruptions"
          linkLabel="halifax.ca"
        >
          <GettingAroundBlock
            detours={detours}
            ferryAlerts={[]}
            adjustments={adjustments}
            emptyMessage="No active transit disruptions."
            emptySubMessage="Halifax Transit is running on regular routes."
          />
        </CollapsibleSection>

        <CollapsibleSection
          icon={<IconFlame className="w-5 h-5" />}
          title="Active Incidents"
          meta="past 60 min"
          href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
          linkLabel="HRFE feed"
        >
          <HrfeBlock incidents={hrfeIncidents} />
        </CollapsibleSection>

        <CollapsibleSection
          icon={<IconLandmark className="w-5 h-5" />}
          title="HRM News"
          meta={hrmDateLabel}
          href="https://www.halifax.ca/home/news"
          linkLabel="halifax.ca"
        >
          <HrmNewsBlock items={hrmNews} />
        </CollapsibleSection>

        <CollapsibleSection
          icon={<IconCalendar className="w-5 h-5" />}
          title="HRM Events"
          href="https://www.halifax.ca/home/events-calendar"
          linkLabel="halifax.ca"
        >
          {/* data-no-tab-swipe on BOTH wrapper and iframe: iOS Safari forwards
              touches from inside iframes to the parent, which would arm the
              swipe-to-switch-tab / pull-to-refresh gestures and reload the
              embed (visible flicker). The opt-out is read off whichever node
              iOS reports as the touch target. */}
          <div
            data-no-tab-swipe
            className="rounded-xl overflow-hidden border border-border shadow-sm bg-white p-2"
          >
            <iframe
              data-no-tab-swipe
              src={HRM_CALENDAR_SRC}
              style={{ border: 0 }}
              width="100%"
              height="480"
              title="HRM Events Calendar"
            />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}
