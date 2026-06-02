"use client";

import type { ReactNode } from "react";
import AlertsBlock from "@/components/blocks/AlertsBlock";
import HalifaxWebcams from "@/components/HalifaxWebcams";
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
  IconCamera,
  IconCloudSun,
  IconWaves,
  IconFerry,
  IconBus,
  IconFlame,
  IconLandmark,
  IconCalendar,
} from "@/components/icons";
import { HRM_CALENDAR_SRC } from "@/lib/data/hrm-calendar";
import type { DashboardData } from "./DesktopShell";

const DISRUPTIONS_URL = "https://www.halifax.ca/transportation/halifax-transit/service-disruptions";

// Desktop-only City Live: the same content blocks as the mobile screen, but
// laid out as an always-expanded multi-column wall instead of a one-at-a-time
// accordion. The mobile CityLiveScreen is left completely untouched — this
// reuses the underlying blocks, not the screen.
export default function CityLiveBoard({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <AlertsBlock alerts={data.alerts} />

      <div className="gap-4 columns-2 2xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <SectionCard icon={<IconCamera className="w-5 h-5" />} title="Webcams" meta="Halifax">
          <HalifaxWebcams />
        </SectionCard>

        <SectionCard icon={<IconCloudSun className="w-5 h-5" />} title="Weather & Marine" meta="Halifax">
          <WeatherBlock
            weather={data.weather}
            tideGraph={data.tideGraph}
            airQuality={data.airQuality}
            burnStatus={data.burnStatus}
          />
        </SectionCard>

        {/* Marine & wind: expanded (headless). The Windy iframe carries
            loading="lazy", so its tiles still defer until scrolled near. */}
        <SectionCard icon={<IconWaves className="w-5 h-5" />} title="Marine & Wind Map" meta="Halifax Harbour">
          <WindyMapBlock headless buoy={data.buoy} marineForecast={data.marineForecast} />
        </SectionCard>

        <SectionCard icon={<IconFerry className="w-5 h-5" />} title="Ferry" href={DISRUPTIONS_URL} linkLabel="halifax.ca">
          <GettingAroundBlock
            detours={[]}
            ferryAlerts={data.ferryAlerts}
            adjustments={null}
            emptyMessage="No active ferry alerts."
            emptySubMessage="Alderney and Woodside ferries running on regular schedule."
          />
        </SectionCard>

        <SectionCard icon={<IconBus className="w-5 h-5" />} title="Transit" href={DISRUPTIONS_URL} linkLabel="halifax.ca">
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
          icon={<IconFlame className="w-5 h-5" />}
          title="Active Incidents"
          meta="past 60 min"
          href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
          linkLabel="HRFE feed"
        >
          <HrfeBlock incidents={data.hrfeIncidents} />
        </SectionCard>

        <SectionCard
          icon={<IconLandmark className="w-5 h-5" />}
          title="HRM News"
          meta={data.hrmDateLabel}
          href="https://www.halifax.ca/home/news"
          linkLabel="halifax.ca"
        >
          <HrmNewsBlock items={data.hrmNews} />
        </SectionCard>

        <SectionCard
          icon={<IconCalendar className="w-5 h-5" />}
          title="HRM Events"
          meta="community calendar"
          href="https://www.halifax.ca/home/events-calendar"
          linkLabel="halifax.ca"
        >
          <CalendarEmbed src={HRM_CALENDAR_SRC} />
        </SectionCard>

        {/* WasteCollectionBlock renders its own collapsible section + needs an
            AccordionGroup context. Wrap it in a fresh group and card surface. */}
        <div className="rounded-2xl border border-border bg-card shadow-sm px-4 py-2 [&>*]:!mt-0">
          <AccordionGroup>
            <WasteCollectionBlock />
          </AccordionGroup>
        </div>

        {/* CapitalBudgetBlock already renders its own bordered card. */}
        <CapitalBudgetBlock />

        <SectionCard icon={<IconLandmark className="w-5 h-5" />} title="Have Your Say" meta="get involved">
          <CivicEngagementBlock />
        </SectionCard>
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
  children,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-border/60">
        <span className="text-foreground/55 shrink-0">{icon}</span>
        <h2 className="text-base font-bold text-foreground truncate">{title}</h2>
        {meta && <span className="text-xs text-foreground/40 truncate">· {meta}</span>}
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
      <div className="px-4 py-3.5">{children}</div>
    </section>
  );
}
