"use client";

import {
  DashboardHeader,
  AlertsStrip,
  WebcamWidget,
  GettingAroundWidget,
  MarineWidget,
  IncidentsWidget,
  WasteWidget,
  RedditWidget,
  HeadlinesWidget,
  HrmNewsWidget,
  EventsWidget,
  CostOfLivingWidget,
  GroceryWidget,
  CapitalBudgetWidget,
  WinterParkingWidget,
  CivicEngagementWidget,
} from "./widgets";
import WeatherBlock from "@/components/blocks/WeatherBlock";
import type { DashboardData, DesktopSection } from "./DesktopShell";

export default function TodayBoard({
  data,
  onNavigate,
}: {
  data: DashboardData;
  onNavigate: (section: DesktopSection) => void;
}) {
  const toCity = () => onNavigate("city");
  return (
    <div className="space-y-5">
      <DashboardHeader />

      {/* Attention row — alerts (or an all-clear strip), full width. */}
      <AlertsStrip alerts={data.alerts} />

      {/* One balanced 3-column masonry for the whole board. Weather sits in a
          single 1/3-width column (its conditions grid is relaxed to 2 cols via
          the .today-weather rule in globals.css so it doesn't cram); the live
          cam and every widget flow around it, and CSS column-balancing keeps
          the columns even — no tall-and-empty gaps. Drops to 2 columns on
          narrower desktops. */}
      <div className="gap-4 columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
        <WebcamWidget />
        <div className="today-weather [&>*]:!mb-0">
          <WeatherBlock
            weather={data.weather}
            tideGraph={data.tideGraph}
            airQuality={data.airQuality}
            burnStatus={data.burnStatus}
          />
        </div>
        <MarineWidget
          buoy={data.buoy}
          marineForecast={data.marineForecast}
          tideGraph={data.tideGraph}
          onOpen={toCity}
        />
        <GettingAroundWidget
          detours={data.detours}
          ferryAlerts={data.ferryAlerts}
          adjustments={data.adjustments}
          onOpen={toCity}
        />
        <IncidentsWidget incidents={data.hrfeIncidents} onOpen={toCity} />
        <WasteWidget onOpen={toCity} />
        <WinterParkingWidget ban={data.winterParkingBan} onOpen={toCity} />
        <RedditWidget posts={data.redditPosts} onOpen={() => onNavigate("pulse")} />
        <HeadlinesWidget news={data.news} onOpen={() => onNavigate("pulse")} />
        <EventsWidget events={data.events} onOpen={() => onNavigate("events")} />
        <HrmNewsWidget items={data.hrmNews} dateLabel={data.hrmDateLabel} onOpen={toCity} />
        <CostOfLivingWidget gasPrices={data.gasPrices} onOpen={() => onNavigate("stats")} />
        <GroceryWidget groceryPrices={data.groceryPrices} onOpen={() => onNavigate("stats")} />
        <CapitalBudgetWidget onOpen={toCity} />
        <CivicEngagementWidget />
      </div>
    </div>
  );
}
