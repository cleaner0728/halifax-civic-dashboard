"use client";

import { useState, useEffect, useCallback } from "react";
import BrandTitle from "@/components/BrandTitle";
import SettingsMenu from "@/components/SettingsMenu";
import CityLiveBoard from "./CityLiveBoard";
import PulseBoard from "./PulseBoard";
import EventsCalendarScreen from "@/components/screens/EventsCalendarScreen";
import StatsScreen from "@/components/screens/StatsScreen";
import { IconCity, IconPulse, IconTicket, IconChart } from "@/components/icons";
import type { WeatherData } from "@/lib/fetchers/weather";
import type { TideGraphData } from "@/lib/fetchers/tides";
import type { AirQuality } from "@/lib/fetchers/air-quality";
import type { BurnStatus } from "@/lib/fetchers/burn-status";
import type { WeatherAlert } from "@/lib/fetchers/alerts";
import type { HrmItem } from "@/lib/fetchers/hrm";
import type { TransitDetour, FerryAlert, TransitAdjustment } from "@/lib/fetchers/transit";
import type { BuoyObservation } from "@/lib/fetchers/buoy";
import type { MarineForecast } from "@/lib/fetchers/marine-forecast";
import type { RedditPost } from "@/lib/fetchers/reddit";
import type { NewsItem } from "@/lib/fetchers/news";
import type { HalifaxEvent } from "@/lib/fetchers/events";
import type { GasPriceData } from "@/lib/fetchers/gas";
import type { GroceryPriceData } from "@/lib/fetchers/grocery";
import type { WinterParkingBan } from "@/lib/fetchers/winter-parking";

// Everything the desktop experience renders. It's the exact superset of what
// the four mobile screens already consume — page.tsx fetches it once and hands
// the same object to both trees, so the desktop board never triggers an extra
// request.
export type DashboardData = {
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
  winterParkingBan: WinterParkingBan | null;
  news: NewsItem[];
  redditPosts: RedditPost[];
  redditFetchedAt: string | null;
  events: HalifaxEvent[];
  gasPrices: GasPriceData;
  groceryPrices: GroceryPriceData;
  renderedAt: number;
};

export type DesktopSection = "city" | "pulse" | "events" | "stats";

const NAV: { id: DesktopSection; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "city", label: "City Live", Icon: IconCity },
  { id: "pulse", label: "Pulse", Icon: IconPulse },
  { id: "events", label: "Events", Icon: IconTicket },
  { id: "stats", label: "Stats", Icon: IconChart },
];

export default function DesktopShell({ data }: { data: DashboardData }) {
  const [active, setActive] = useState<DesktopSection>("city");

  // Bare 1–4 jumps between sections — conflict-free (unlike ⌘1–4, which the
  // browser swallows for tab switching). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const idx = Number(e.key) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < NAV.length) {
        e.preventDefault();
        setActive(NAV[idx].id);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback((section: DesktopSection) => {
    setActive(section);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — sticky, full viewport height, scrolls with nothing. */}
      <aside className="w-60 shrink-0 sticky top-0 h-dvh border-r border-border bg-card/70 backdrop-blur-md flex flex-col">
        <div className="px-4 py-4">
          <BrandTitle />
        </div>
        <nav className="flex-1 px-2 space-y-1" aria-label="Dashboard sections">
          {NAV.map(({ id, label, Icon }, i) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-current={isActive ? "page" : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-foreground/60 hover:text-foreground hover:bg-foreground/5 font-medium"
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.25 : 2} />
                <span className="flex-1 text-left">{label}</span>
                <kbd className="text-[10px] font-mono text-foreground/30">{i + 1}</kbd>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-foreground/35">Press 1–4</span>
          {/* Gear sits at the bottom of the viewport, so open the menu upward. */}
          <SettingsMenu menuPositionClass="bottom-full right-0 mb-2" />
        </div>
      </aside>

      {/* Content — window-scrolled, capped so it doesn't sprawl on huge displays. */}
      <div className="flex-1 min-w-0">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          {active === "city" ? (
            <CityLiveBoard data={data} />
          ) : active === "pulse" ? (
            <PulseBoard data={data} />
          ) : (
            <div className="desktop-pane">{renderScreen(active, data)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reused mobile screens, unchanged, as desktop detail panes. City Live has its
// own purpose-built desktop board (CityLiveBoard); the rest reuse their screens.
function renderScreen(section: DesktopSection, data: DashboardData) {
  switch (section) {
    case "events":
      return <EventsCalendarScreen renderedAt={data.renderedAt} events={data.events} />;
    case "stats":
      return <StatsScreen gasPrices={data.gasPrices} groceryPrices={data.groceryPrices} />;
    default:
      return null;
  }
}
