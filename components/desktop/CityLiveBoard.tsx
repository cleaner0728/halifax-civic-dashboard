"use client";

import type { ReactNode } from "react";
import AlertsBlock from "@/components/blocks/AlertsBlock";
import HalifaxWebcamWall from "@/components/HalifaxWebcamWall";
import WeatherBlock from "@/components/blocks/WeatherBlock";
import WindyMapBlock from "@/components/blocks/WindyMapBlock";
import GettingAroundBlock from "@/components/blocks/GettingAroundBlock";
import HrfeBlock from "@/components/blocks/HrfeBlock";
import HrmNewsBlock from "@/components/blocks/HrmNewsBlock";
import WasteCollectionBlock from "@/components/blocks/WasteCollectionBlock";
import CapitalBudgetBlock from "@/components/blocks/CapitalBudgetBlock";
import CivicEngagementBlock from "@/components/blocks/CivicEngagementBlock";
import WinterParkingBanBlock from "@/components/blocks/WinterParkingBanBlock";
import CalendarEmbed from "@/components/CalendarEmbed";
import { AccordionGroup } from "@/components/AccordionGroup";
import {
  IconCloudSun,
  IconWaves,
  IconFerry,
  IconBus,
  IconFlame,
  IconLandmark,
  IconCalendar,
  IconTicket,
} from "@/components/icons";
import { HRM_CALENDAR_SRC } from "@/lib/data/hrm-calendar";
import { formatRelative } from "@/lib/date";
import type { HalifaxEvent } from "@/lib/fetchers/events";
import type { DashboardData } from "./DesktopShell";

const DISRUPTIONS_URL = "https://www.halifax.ca/transportation/halifax-transit/service-disruptions";

// Desktop City Live, redesigned as a dense, structured information wall.
// Top row: four live webcams. Second row: weather, marine/wind, today's
// waste, HRM calendar. Then alerts + news + events + incidents. Tiles tall
// enough for primary content get a max-height + internal scroll so the row
// rhythm stays consistent. Mobile CityLiveScreen is left untouched.
export default function CityLiveBoard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      {/* Row 1 — webcam wall. Four cameras live at once across the full
          width of the board. */}
      <HalifaxWebcamWall />

      {/* Row 2 — weather + marine/wind + waste + HRM calendar. Row height
          is 500px — close to Waste's natural content height so the inner
          schedule card doesn't leave a big visible gap above its bottom
          edge. The HRM Calendar URL has its `height=460` matched to the
          iframe's actual rendered space (500 minus the SectionCard header)
          so its internal layout doesn't trigger a second scrollbar. Weather
          and Marine & Wind have always overflowed at any reasonable tile
          height, so they keep their internal scroll. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 [grid-auto-rows:500px]">
        <SectionCard
          icon={<IconCloudSun className="w-5 h-5" />}
          title="Weather"
          meta="Halifax"
        >
          <WeatherBlock
            weather={data.weather}
            tideGraph={data.tideGraph}
            airQuality={data.airQuality}
            burnStatus={data.burnStatus}
          />
        </SectionCard>

        <SectionCard
          icon={<IconWaves className="w-5 h-5" />}
          title="Marine & Wind"
          meta="Halifax Harbour"
        >
          <WindyMapBlock headless buoy={data.buoy} marineForecast={data.marineForecast} />
        </SectionCard>

        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <div
            className="
              px-4 py-3 overflow-y-auto flex-1 flex flex-col
              [&>div]:!mt-0
              [&>div]:flex [&>div]:flex-col [&>div]:flex-1
              [&>div>div]:flex [&>div>div]:flex-col [&>div>div]:flex-1
              [&>div>div>div]:flex-1
            "
          >
            <AccordionGroup defaultOpenId="waste">
              <WasteCollectionBlock />
            </AccordionGroup>
          </div>
        </div>

        <SectionCard
          icon={<IconCalendar className="w-5 h-5" />}
          title="HRM Calendar"
          meta="community"
          href="https://www.halifax.ca/home/events-calendar"
          linkLabel="halifax.ca"
          noPadding
        >
          <CalendarEmbed src={HRM_CALENDAR_SRC} fill />
        </SectionCard>
      </div>

      {/* Row 3 — alerts, HRM news, upcoming events, fire incidents. Same
          fixed-row-height treatment as row 2; tile heights are uniform and
          tile bodies scroll when they overflow. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 [grid-auto-rows:520px]">
        <SectionCard
          icon={<IconFlame className="w-5 h-5" />}
          title="Alerts"
        >
          {data.alerts.length > 0 ? (
            <AlertsBlock alerts={data.alerts} />
          ) : (
            <EmptyState text="No active weather alerts." />
          )}
        </SectionCard>

        <SectionCard
          icon={<IconLandmark className="w-5 h-5" />}
          title="HRM News"
          meta={data.hrmDateLabel}
          hasUpdate={data.hrmNewsHasUpdate}
          href="https://www.halifax.ca/home/news"
          linkLabel="halifax.ca"
        >
          <HrmNewsBlock items={data.hrmNews} />
        </SectionCard>

        <SectionCard
          icon={<IconTicket className="w-5 h-5" />}
          title="Events"
          meta={`${data.events.length} upcoming`}
        >
          <UpcomingEventsTile events={data.events} />
        </SectionCard>

        <SectionCard
          icon={<IconFlame className="w-5 h-5" />}
          title="Incidents"
          meta="past 60 min"
          hasUpdate={data.incidentsHasUpdate}
          href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
          linkLabel="HRFE"
        >
          <HrfeBlock incidents={data.hrfeIncidents} />
        </SectionCard>
      </div>

      {/* Row 4 — getting around + civic. Same equal-height treatment. The
          Capital Budget card owns its own bordered shell, so wrap it in a
          flex column matching the surrounding SectionCards so it stretches
          and scrolls consistently with its row-mates. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 [grid-auto-rows:520px]">
        <SectionCard
          icon={<IconBus className="w-5 h-5" />}
          title="Transit"
          hasUpdate={data.transitHasUpdate}
          href={DISRUPTIONS_URL}
          linkLabel="halifax.ca"
        >
          <WinterParkingBanBlock ban={data.winterParkingBan} />
          <GettingAroundBlock
            detours={data.detours}
            ferryAlerts={[]}
            adjustments={data.adjustments}
            emptyMessage="No active transit disruptions."
            emptySubMessage="Halifax Transit is running on regular routes."
          />
        </SectionCard>

        <SectionCard
          icon={<IconFerry className="w-5 h-5" />}
          title="Ferry"
          hasUpdate={data.ferryHasUpdate}
          href={DISRUPTIONS_URL}
          linkLabel="halifax.ca"
        >
          <GettingAroundBlock
            detours={[]}
            ferryAlerts={data.ferryAlerts}
            adjustments={null}
            emptyMessage="No active ferry alerts."
            emptySubMessage="Alderney and Woodside running regular schedule."
          />
        </SectionCard>

        <SectionCard
          icon={<IconLandmark className="w-5 h-5" />}
          title="Have Your Say"
          meta="civic"
        >
          <CivicEngagementBlock />
        </SectionCard>

        {/* CapitalBudgetBlock owns its own bordered card; wrap so it
            stretches + scrolls inside the row's fixed height. */}
        <div className="overflow-y-auto [&>*]:!mt-0 [&>*]:h-full">
          <CapitalBudgetBlock />
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  meta,
  href,
  linkLabel,
  hasUpdate,
  maxHeight,
  noPadding,
  children,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
  hasUpdate?: boolean;
  maxHeight?: string;
  noPadding?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-border/60 shrink-0">
        <span className="text-foreground/55 shrink-0">{icon}</span>
        <h2 className="text-base font-bold text-foreground truncate">{title}</h2>
        {meta && <span className="text-xs text-foreground/40 truncate">· {meta}</span>}
        {hasUpdate && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-semibold px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" aria-hidden />
            New
          </span>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            {linkLabel ?? "source"} ↗
          </a>
        )}
      </header>
      <div
        className={`${noPadding ? "" : "px-4 py-3.5"} overflow-y-auto flex-1`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-foreground/45 text-center py-8 leading-relaxed">
      {text}
    </p>
  );
}

// Compact "what's coming up" list for the City Live wall. Surfaces the next
// few items from the events feed — the full searchable list lives on the
// Events tab. We slice to keep the tile glanceable.
function UpcomingEventsTile({ events }: { events: HalifaxEvent[] }) {
  if (events.length === 0) {
    return <EmptyState text="No upcoming events." />;
  }
  return (
    <ul className="space-y-3">
      {events.slice(0, 6).map((ev) => (
        <li key={ev.url}>
          <a
            href={ev.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
              {ev.date_text || formatRelative(ev.start_at)}
            </p>
            <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
              {ev.title}
            </p>
            {ev.venue_name && (
              <p className="text-xs text-foreground/50 mt-0.5 truncate">
                {ev.venue_name}
              </p>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
