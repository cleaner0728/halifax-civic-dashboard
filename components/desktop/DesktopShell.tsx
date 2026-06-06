"use client";

import { useState, useEffect, useCallback } from "react";
import BrandTitle from "@/components/BrandTitle";
import SettingsMenu from "@/components/SettingsMenu";
import CityLiveBoard from "./CityLiveBoard";
import PulseBoard from "./PulseBoard";
import DiscussionBoard from "./DiscussionBoard";
import EventsCalendarScreen from "@/components/screens/EventsCalendarScreen";
import StatsScreen from "@/components/screens/StatsScreen";
import { IconCity, IconPulse, IconTicket, IconChart, IconMessages } from "@/components/icons";
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
import type { RedditVoice } from "@/lib/fetchers/reddit-voices";
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
  redditVoices: RedditVoice[];
  events: HalifaxEvent[];
  gasPrices: GasPriceData;
  groceryPrices: GroceryPriceData;
  renderedAt: number;
};

export type DesktopSection = "city" | "pulse" | "discussion" | "events" | "stats";

const NAV: { id: DesktopSection; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "city", label: "City Live", Icon: IconCity },
  { id: "pulse", label: "Pulse", Icon: IconPulse },
  { id: "discussion", label: "Discussion", Icon: IconMessages },
  { id: "events", label: "Events", Icon: IconTicket },
  { id: "stats", label: "Stats", Icon: IconChart },
];

export default function DesktopShell({ data }: { data: DashboardData }) {
  const [active, setActive] = useState<DesktopSection>("city");
  // Drawer collapsed by default so the dashboard takes the full viewport.
  // Open on hamburger click or any 1-5 keypress; close on Escape, backdrop
  // click, or after picking a section.
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
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
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return (
    <div className="min-h-dvh">
      {/* Floating top-left hamburger. Always visible so the drawer is
          reachable no matter where the user has scrolled. */}
      <button
        type="button"
        onClick={() => setDrawerOpen((o) => !o)}
        aria-label={drawerOpen ? "Close menu" : "Open menu"}
        aria-expanded={drawerOpen}
        className="fixed top-4 left-4 z-50 grid place-items-center w-10 h-10 rounded-xl border border-border bg-card/85 backdrop-blur-md text-foreground/80 hover:text-foreground hover:bg-card shadow-sm transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {drawerOpen ? (
            <>
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </>
          ) : (
            <>
              <path d="M3 12h18" />
              <path d="M3 6h18" />
              <path d="M3 18h18" />
            </>
          )}
        </svg>
      </button>

      {/* Floating top-right settings gear — sibling to the hamburger so users
          can change theme / language without opening the drawer. */}
      <div className="fixed top-4 right-4 z-50">
        <SettingsMenu menuPositionClass="top-full right-0 mt-2" />
      </div>

      {/* Backdrop — only present while the drawer is open. Click to close. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] cursor-default"
        />
      )}

      {/* Drawer — overlays the content, doesn't push it. translate-x for the
          slide so layout never reflows. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card/95 backdrop-blur-md shadow-2xl flex flex-col transition-transform duration-200 ease-out ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!drawerOpen}
      >
        <div className="px-4 pt-16 pb-4">
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
                tabIndex={drawerOpen ? 0 : -1}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
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
        <div className="px-4 py-3 border-t border-border text-[11px] text-foreground/40">
          Press <kbd className="font-mono">1</kbd>–<kbd className="font-mono">5</kbd> to switch · <kbd className="font-mono">Esc</kbd> to close
        </div>
      </aside>

      {/* Content — full-width. Each board manages its own internal width cap
          (city / events / stats clamp to 1600px; pulse + discussion go
          edge-to-edge so their tile grids can fill 4K). The top padding gives
          the floating hamburger room to breathe. */}
      <main className="px-6 pt-16 pb-6">
        {active === "city" ? (
          // City Live goes edge-to-edge so the 4-up webcam wall + tile grid
          // fill ultrawide / 4K displays. Pulse and Discussion already do the
          // same.
          <CityLiveBoard data={data} />
        ) : active === "pulse" ? (
          <PulseBoard data={data} />
        ) : active === "discussion" ? (
          <DiscussionBoard data={data} />
        ) : (
          // Events + Stats keep a reading-width cap so calendar grids and
          // chart blocks don't sprawl awkwardly on 4K.
          <div className="max-w-[1600px] mx-auto desktop-pane">{renderScreen(active, data)}</div>
        )}
      </main>
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
