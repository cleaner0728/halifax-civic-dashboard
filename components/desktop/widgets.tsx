"use client";

import { useState } from "react";
import WidgetCard from "./WidgetCard";
import LiveClock from "@/components/LiveClock";
import HalifaxWebcams from "@/components/HalifaxWebcams";
import {
  IconCloudSun,
  IconBus,
  IconFlame,
  IconMessages,
  IconNews,
  IconLandmark,
  IconTicket,
  IconFuel,
  IconCheck,
  IconClock,
  IconTrash,
  IconWaves,
  IconCart,
} from "@/components/icons";
import { getWeatherInfo } from "@/lib/weather-theme";
import { formatRelative, getDayName, toHfxDateStr, formatUtcAsHfxTime, HFX_TZ } from "@/lib/date";
import { AREAS, nextPickup, type Area, type CollectionDow, type Stream } from "@/lib/data/waste-2026";
import { CATEGORIES, TOTAL_4YR, PDF_URL } from "@/lib/capital-budget-data";
import type { WeatherData } from "@/lib/fetchers/weather";
import type { AirQuality } from "@/lib/fetchers/air-quality";
import type { BurnStatus } from "@/lib/fetchers/burn-status";
import type { TideGraphData } from "@/lib/fetchers/tides";
import type { BuoyObservation } from "@/lib/fetchers/buoy";
import type { MarineForecast } from "@/lib/fetchers/marine-forecast";
import type { WeatherAlert } from "@/lib/fetchers/alerts";
import type { TransitDetour, FerryAlert, TransitAdjustment } from "@/lib/fetchers/transit";
import type { HrmItem } from "@/lib/fetchers/hrm";
import type { RedditPost } from "@/lib/fetchers/reddit";
import type { NewsItem } from "@/lib/fetchers/news";
import type { HalifaxEvent } from "@/lib/fetchers/events";
import type { GasPriceData } from "@/lib/fetchers/gas";
import type { GroceryPriceData } from "@/lib/fetchers/grocery";
import type { WinterParkingBan } from "@/lib/fetchers/winter-parking";

// ── helpers ────────────────────────────────────────────────────────────────

function aqiInfo(aqi: number) {
  if (aqi <= 50) return { label: "Good", cls: "text-emerald-600 dark:text-emerald-400" };
  if (aqi <= 100) return { label: "Moderate", cls: "text-yellow-600 dark:text-yellow-500" };
  if (aqi <= 150) return { label: "Unhealthy (SG)", cls: "text-orange-600 dark:text-orange-400" };
  return { label: "Unhealthy", cls: "text-red-600 dark:text-red-400" };
}

function burnInfo(level: BurnStatus["level"]) {
  switch (level) {
    case "allowed":
      return { label: "Allowed", cls: "text-emerald-600 dark:text-emerald-400" };
    case "restricted":
      return { label: "Restricted", cls: "text-amber-600 dark:text-amber-400" };
    case "no-burn":
      return { label: "No burning", cls: "text-red-600 dark:text-red-400" };
  }
}

const STREAM_DOT: Record<Stream, string> = {
  organics: "bg-emerald-500",
  recycling: "bg-sky-500",
  garbage: "bg-stone-500",
};

// Module-scope so the time read isn't an impurity in a component's render.
function isRecent(pubDate: string | undefined, days: number): boolean {
  if (!pubDate) return false;
  const ms = new Date(pubDate).getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms < days * 86_400_000;
}

const ALERT_CLS: Record<WeatherAlert["color"], string> = {
  red: "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
  amber: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  blue: "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

// Soft "all clear" row reused by the calm states of several widgets.
function AllClear({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
      <IconCheck className="w-4 h-4 shrink-0" />
      <span className="text-foreground/70">{children}</span>
    </div>
  );
}

// ── header (greeting + live clock) ──────────────────────────────────────────

export function DashboardHeader() {
  // Lazy initializer runs once on client mount — keeps render pure (no Date in
  // the render body) and avoids a placeholder flash.
  const [{ greeting, dateLabel }] = useState(() => {
    const now = new Date();
    const dateLabel = now.toLocaleDateString("en-US", {
      timeZone: HFX_TZ,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const h = Number(now.toLocaleString("en-US", { timeZone: HFX_TZ, hour: "numeric", hour12: false }));
    const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    return { greeting, dateLabel };
  });

  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}, Halifax</h1>
        <p className="text-sm text-foreground/55 mt-0.5">{dateLabel}</p>
      </div>
      <div className="flex items-center gap-2 text-foreground/70">
        <IconClock className="w-4 h-4" />
        <LiveClock className="text-lg font-semibold tabular-nums" />
      </div>
    </div>
  );
}

// ── alerts (full-width banner / all-clear strip) ────────────────────────────

export function AlertsStrip({ alerts }: { alerts: WeatherAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] px-4 py-3">
        <AllClear>No active weather alerts for Halifax.</AllClear>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {alerts.slice(0, 2).map((a, i) => (
        <a
          key={`${a.title}-${i}`}
          href={a.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`block rounded-2xl border px-4 py-3 transition hover:brightness-105 ${ALERT_CLS[a.color]}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider">{a.severity}</span>
            <span className="text-sm font-semibold truncate">{a.title}</span>
          </div>
          {a.impact && a.impact !== "—" && (
            <p className="text-xs mt-1 text-foreground/70 line-clamp-2">{a.impact}</p>
          )}
        </a>
      ))}
    </div>
  );
}

// ── weather ─────────────────────────────────────────────────────────────────

export function WeatherWidget({
  weather,
  airQuality,
  burnStatus,
  onOpen,
}: {
  weather: WeatherData | null;
  airQuality: AirQuality | null;
  burnStatus: BurnStatus | null;
  onOpen: () => void;
}) {
  if (!weather) {
    return (
      <WidgetCard title="Weather" icon={<IconCloudSun className="w-4 h-4" />} onOpen={onOpen}>
        <p className="text-sm text-foreground/50">Weather data is unavailable right now.</p>
      </WidgetCard>
    );
  }

  const info = getWeatherInfo(weather.weatherCode, !weather.isDay);
  const today = weather.daily[0];
  const aq = airQuality ? aqiInfo(airQuality.aqi) : null;
  const burn = burnStatus ? burnInfo(burnStatus.level) : null;

  return (
    <WidgetCard
      title="Weather"
      icon={<IconCloudSun className="w-4 h-4" />}
      meta="Halifax"
      onOpen={onOpen}
    >
      <div className="flex items-center gap-4">
        <span className="text-5xl leading-none" aria-hidden>
          {info.emoji}
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
              {Math.round(weather.temperature)}°
            </span>
            <span className="text-sm text-foreground/55">
              feels {Math.round(weather.apparentTemp)}°
            </span>
          </div>
          <p className="text-sm font-medium text-foreground/70 truncate">{info.label}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/60">
        {today && (
          <span>
            <span className="text-foreground/80 font-medium">{Math.round(today.maxTemp)}°</span> /{" "}
            {Math.round(today.minTemp)}°
          </span>
        )}
        {aq && (
          <span>
            Air <span className={`font-semibold ${aq.cls}`}>{aq.label}</span>
            <span className="text-foreground/40"> ({airQuality!.aqi})</span>
          </span>
        )}
        {burn && (
          <span>
            Burn <span className={`font-semibold ${burn.cls}`}>{burn.label}</span>
          </span>
        )}
      </div>

      {/* Detail grid — fills the card next to the taller webcam and adds the
          at-a-glance density the desktop layout is meant to provide. */}
      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/60 pt-3 text-sm">
        <Stat label="Wind" value={`${Math.round(weather.windSpeed)} km/h`} />
        <Stat label="Humidity" value={`${weather.humidity}%`} />
        <Stat label="UV index" value={`${weather.uvIndex}`} />
        <Stat label="Dew point" value={`${Math.round(weather.dewpoint)}°`} />
      </dl>
    </WidgetCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-xs text-foreground/45">{label}</dt>
      <dd className="font-medium text-foreground/80 tabular-nums">{value}</dd>
    </div>
  );
}

// ── getting around (transit + ferry) ────────────────────────────────────────

export function GettingAroundWidget({
  detours,
  ferryAlerts,
  adjustments,
  onOpen,
}: {
  detours: TransitDetour[];
  ferryAlerts: FerryAlert[];
  adjustments: TransitAdjustment | null;
  onOpen: () => void;
}) {
  const total = detours.length + ferryAlerts.length;
  const items = [
    ...detours.map((d) => ({ title: d.title, sub: d.routes ? `Routes ${d.routes}` : "Detour" })),
    ...ferryAlerts.map((f) => ({ title: f.title, sub: "Ferry" })),
  ].slice(0, 3);

  return (
    <WidgetCard
      title="Getting Around"
      icon={<IconBus className="w-4 h-4" />}
      meta={total > 0 ? `${total} active` : undefined}
      onOpen={onOpen}
    >
      {total === 0 ? (
        <AllClear>Transit &amp; ferries on regular schedule.</AllClear>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium text-foreground line-clamp-1">{it.title}</p>
              <p className="text-xs text-foreground/50">{it.sub}</p>
            </li>
          ))}
        </ul>
      )}
      {adjustments && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Service changes coming {adjustments.dateLabel}
        </p>
      )}
    </WidgetCard>
  );
}

// ── active incidents (HRFE) ─────────────────────────────────────────────────

export function IncidentsWidget({
  incidents,
  onOpen,
}: {
  incidents: HrmItem[];
  onOpen: () => void;
}) {
  return (
    <WidgetCard
      title="Active Incidents"
      icon={<IconFlame className="w-4 h-4" />}
      meta="past 60 min"
      onOpen={onOpen}
    >
      {incidents.length === 0 ? (
        <AllClear>No HRFE incidents in the past hour.</AllClear>
      ) : (
        <ul className="space-y-2">
          {incidents.slice(0, 3).map((it, i) => (
            <li key={i} className="text-sm flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground line-clamp-1">{it.title}</span>
              <span className="text-xs text-foreground/45 shrink-0">{formatRelative(it.pubDate)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ── r/halifax ───────────────────────────────────────────────────────────────

export function RedditWidget({
  posts,
  onOpen,
}: {
  posts: RedditPost[];
  onOpen: () => void;
}) {
  const [top, ...rest] = posts;
  return (
    <WidgetCard
      title="r/halifax"
      icon={<IconMessages className="w-4 h-4" />}
      meta="hot"
      onOpen={onOpen}
      openLabel="Pulse"
    >
      {!top ? (
        <p className="text-sm text-foreground/50">No posts loaded.</p>
      ) : (
        <>
          <a
            href={top.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <p className="text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
              {top.title}
            </p>
            <p className="text-xs text-foreground/45 mt-1">
              ▲ {top.score} · {top.numComments} comments · {formatRelative(top.createdUtc * 1000)}
            </p>
          </a>
          {rest.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5">
              {rest.slice(0, 3).map((p, i) => (
                <li key={i}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-foreground/70 hover:text-foreground line-clamp-1"
                  >
                    <span className="text-foreground/40">▲ {p.score}</span> {p.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </WidgetCard>
  );
}

// ── headlines ───────────────────────────────────────────────────────────────

export function HeadlinesWidget({
  news,
  onOpen,
}: {
  news: NewsItem[];
  onOpen: () => void;
}) {
  return (
    <WidgetCard
      title="Latest Headlines"
      icon={<IconNews className="w-4 h-4" />}
      meta={`${news.length} today`}
      onOpen={onOpen}
      openLabel="Pulse"
    >
      {news.length === 0 ? (
        <p className="text-sm text-foreground/50">No stories yet today.</p>
      ) : (
        <ul className="space-y-2.5">
          {news.slice(0, 4).map((n, i) => (
            <li key={i}>
              <a
                href={n.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <p className="text-sm font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2">
                  {n.title}
                </p>
                <p className="text-xs text-foreground/45 mt-0.5">
                  {n.source}
                  {n.pubDate ? ` · ${formatRelative(n.pubDate)}` : ""}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ── HRM municipal news ──────────────────────────────────────────────────────

export function HrmNewsWidget({
  items,
  dateLabel,
  onOpen,
}: {
  items: HrmItem[];
  dateLabel: string;
  onOpen: () => void;
}) {
  return (
    <WidgetCard
      title="HRM News"
      icon={<IconLandmark className="w-4 h-4" />}
      meta={dateLabel}
      onOpen={onOpen}
    >
      {items.length === 0 ? (
        <p className="text-sm text-foreground/50">No recent municipal updates.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 3).map((it, i) => (
            <li key={i}>
              <a
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
              >
                {it.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ── events ──────────────────────────────────────────────────────────────────

export function EventsWidget({
  events,
  onOpen,
}: {
  events: HalifaxEvent[];
  onOpen: () => void;
}) {
  return (
    <WidgetCard
      title="What's On"
      icon={<IconTicket className="w-4 h-4" />}
      meta={events.length > 0 ? `${events.length} upcoming` : undefined}
      onOpen={onOpen}
      openLabel="Events"
    >
      {events.length === 0 ? (
        <p className="text-sm text-foreground/50">No upcoming events loaded.</p>
      ) : (
        <ul className="space-y-2.5">
          {events.slice(0, 3).map((e, i) => (
            <li key={i} className="flex items-baseline gap-3">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0 w-12">
                {getDayName(toHfxDateStr(e.start_at))}
              </span>
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 text-sm font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
              >
                {e.title}
                {e.venue_name && (
                  <span className="block text-xs font-normal text-foreground/45 line-clamp-1">
                    {e.venue_name}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ── cost of living (gas) ────────────────────────────────────────────────────

export function CostOfLivingWidget({
  gasPrices,
  onOpen,
}: {
  gasPrices: GasPriceData;
  onOpen: () => void;
}) {
  const history = gasPrices.history;
  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const delta = latest && prev ? latest.regular - prev.regular : 0;

  return (
    <WidgetCard
      title="Cost of Living"
      icon={<IconFuel className="w-4 h-4" />}
      meta="gas, regular"
      onOpen={onOpen}
      openLabel="Stats"
    >
      {!latest ? (
        <p className="text-sm text-foreground/50">No price data loaded.</p>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {latest.regular.toFixed(1)}
          </span>
          <span className="text-sm text-foreground/55">¢/L</span>
          {delta !== 0 && (
            <span
              className={`text-xs font-semibold ${
                delta > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}¢
            </span>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

// ── live webcams ────────────────────────────────────────────────────────────

export function WebcamWidget() {
  // HalifaxWebcams is self-contained (own title + cam switcher + source link).
  // We give it a card surface but no WidgetCard header to avoid a double title.
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden px-4 pb-4">
      <HalifaxWebcams />
    </section>
  );
}

// ── forecast (hourly + 5-day) ───────────────────────────────────────────────

export function ForecastWidget({ weather }: { weather: WeatherData | null }) {
  if (!weather || (weather.hourly.length === 0 && weather.daily.length === 0)) return null;
  const hourly = weather.hourly.slice(0, 14);
  const daily = weather.daily.slice(0, 5);
  const fmtHour = (iso: string) =>
    new Date(iso)
      .toLocaleTimeString("en-US", { timeZone: HFX_TZ, hour: "numeric", hour12: true })
      .replace(" ", "");

  return (
    <WidgetCard title="Forecast" icon={<IconCloudSun className="w-4 h-4" />} meta="hourly · 5-day">
      <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
        {hourly.length > 0 && (
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
            {hourly.map((h, i) => {
              const hi = getWeatherInfo(h.weatherCode, false);
              return (
                <div key={i} className="flex flex-col items-center gap-1 shrink-0 w-11">
                  <span className="text-[11px] text-foreground/50">{i === 0 ? "Now" : fmtHour(h.timestamp)}</span>
                  <span className="text-xl leading-none" aria-hidden>{hi.emoji}</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">{Math.round(h.temp)}°</span>
                  <span className="text-[10px] tabular-nums text-sky-600 dark:text-sky-400 h-3">
                    {h.pop > 0 ? `${h.pop}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {daily.length > 0 && (
          <div className="space-y-1.5 lg:border-l lg:border-border/60 lg:pl-6">
            {daily.map((d, i) => {
              const di = getWeatherInfo(d.weatherCode, false);
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-12 text-foreground/60 shrink-0">{getDayName(d.date)}</span>
                  <span className="text-lg leading-none w-6 text-center" aria-hidden>{di.emoji}</span>
                  <span className="flex-1 text-foreground/45 text-xs truncate hidden sm:block">{d.textSummary}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-foreground">{Math.round(d.maxTemp)}°</span>{" "}
                    <span className="text-foreground/45">{Math.round(d.minTemp)}°</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

// ── marine & tides ──────────────────────────────────────────────────────────

export function MarineWidget({
  buoy,
  marineForecast,
  tideGraph,
  onOpen,
}: {
  buoy: BuoyObservation | null;
  marineForecast: MarineForecast | null;
  tideGraph: TideGraphData | null;
  onOpen: () => void;
}) {
  const tides: { kind: string; time: string }[] = [];
  if (tideGraph?.nextHigh) tides.push({ kind: "High", time: tideGraph.nextHigh.time });
  if (tideGraph?.nextLow) tides.push({ kind: "Low", time: tideGraph.nextLow.time });
  tides.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const warnings = marineForecast?.warnings ?? [];
  const hasData = buoy || tides.length > 0 || marineForecast;

  return (
    <WidgetCard title="Marine & Tides" icon={<IconWaves className="w-4 h-4" />} meta="Halifax Harbour" onOpen={onOpen}>
      {!hasData ? (
        <p className="text-sm text-foreground/50">Marine data unavailable right now.</p>
      ) : (
        <>
          {buoy && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {buoy.waterTemp != null && <Stat label="Water" value={`${buoy.waterTemp.toFixed(1)}°`} />}
              {buoy.waveHeightSig != null && <Stat label="Waves" value={`${buoy.waveHeightSig.toFixed(1)} m`} />}
              {buoy.wavePeriodMax != null && <Stat label="Period" value={`${Math.round(buoy.wavePeriodMax)} s`} />}
              {buoy.windSpeed != null && <Stat label="Wind" value={`${Math.round(buoy.windSpeed)} km/h`} />}
            </dl>
          )}
          {tides.length > 0 && (
            <div className="mt-3 border-t border-border/60 pt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
              {tides.slice(0, 2).map((t, i) => (
                <span key={i}>
                  {t.kind} tide{" "}
                  <span className="text-foreground/80 font-medium">{formatUtcAsHfxTime(t.time)}</span>
                </span>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {warnings.map((w, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300"
                >
                  {w.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}

// ── waste collection ────────────────────────────────────────────────────────

const WASTE_KEY = "hfx-waste-prefs-v1";

export function WasteWidget({ onOpen }: { onOpen: () => void }) {
  // The desktop board is client-only (lazy, ssr:false), so localStorage is
  // available on the very first render — read it in a lazy initializer, which
  // keeps the effect (and a loading flash) out of the picture entirely.
  const [prefs] = useState<{ area: Area; dow: CollectionDow } | null>(() => {
    try {
      const raw = localStorage.getItem(WASTE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if ((p?.area === "I" || p?.area === "II") && Number.isInteger(p?.dow) && p.dow >= 1 && p.dow <= 5) {
          return { area: p.area, dow: p.dow };
        }
      }
    } catch {
      // localStorage unavailable (private mode) — fall through to setup prompt.
    }
    return null;
  });

  const next = prefs ? nextPickup(prefs.area, prefs.dow) : null;
  const label = next
    ? new Date(`${next.date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <WidgetCard
      title="Waste Collection"
      icon={<IconTrash className="w-4 h-4" />}
      meta={prefs ? AREAS[prefs.area].label : undefined}
      onOpen={onOpen}
      openLabel="Set up"
    >
      {!next ? (
        <p className="text-sm text-foreground/55">
          Set your area &amp; pickup day in{" "}
          <button onClick={onOpen} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            City Live
          </button>{" "}
          to see your schedule.
        </p>
      ) : (
        <>
          <p className="text-[11px] uppercase tracking-wider text-foreground/45">Next pickup</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{label}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {next.streams.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-foreground/5"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STREAM_DOT[s]}`} aria-hidden />
                {s[0].toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
        </>
      )}
    </WidgetCard>
  );
}

// ── grocery prices ──────────────────────────────────────────────────────────

export function GroceryWidget({
  groceryPrices,
  onOpen,
}: {
  groceryPrices: GroceryPriceData;
  onOpen: () => void;
}) {
  const items = groceryPrices.items.slice(0, 6);
  return (
    <WidgetCard
      title="Grocery Prices"
      icon={<IconCart className="w-4 h-4" />}
      meta="Nova Scotia"
      onOpen={onOpen}
      openLabel="Stats"
    >
      {items.length === 0 ? (
        <p className="text-sm text-foreground/50">No price data loaded.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => {
            const latest = it.history[it.history.length - 1];
            const prev = it.history[it.history.length - 2];
            const delta = latest && prev ? latest.value - prev.value : 0;
            return (
              <li key={it.key} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground/70 truncate">{it.label}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-foreground">${latest?.value.toFixed(2)}</span>
                  <span className="text-foreground/40 text-xs"> {it.unit}</span>
                  {delta !== 0 && (
                    <span
                      className={`ml-1.5 text-xs ${
                        delta > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {delta > 0 ? "▲" : "▼"}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

// ── capital budget (compact) ────────────────────────────────────────────────

export function CapitalBudgetWidget({ onOpen }: { onOpen: () => void }) {
  const fmtM = (k: number) => {
    const m = k / 1000;
    return m >= 100 ? `$${Math.round(m)}M` : `$${m.toFixed(1)}M`;
  };
  const top = [...CATEGORIES].sort((a, b) => b.total - a.total).slice(0, 4);
  return (
    <WidgetCard title="Capital Budget" icon={<IconLandmark className="w-4 h-4" />} meta="2026–2030" onOpen={onOpen}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-foreground tabular-nums">{fmtM(TOTAL_4YR)}</span>
        <span className="text-xs text-foreground/45">4-year plan</span>
      </div>
      <div className="mt-2.5 flex h-2.5 rounded-full overflow-hidden gap-px">
        {CATEGORIES.map((c) => (
          <span
            key={c.key}
            className={c.color}
            style={{ width: `${(c.total / TOTAL_4YR) * 100}%` }}
            title={`${c.label}: ${fmtM(c.total)}`}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1">
        {top.map((c) => (
          <li key={c.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-sm shrink-0 ${c.color}`} />
              <span className="text-foreground/70 truncate">{c.label}</span>
            </span>
            <span className={`shrink-0 font-semibold tabular-nums ${c.textColor}`}>{fmtM(c.total)}</span>
          </li>
        ))}
      </ul>
      <a
        href={PDF_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block mt-2.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        Full budget PDF ↗
      </a>
    </WidgetCard>
  );
}

// ── winter parking ban (seasonal) ───────────────────────────────────────────

export function WinterParkingWidget({
  ban,
  onOpen,
}: {
  ban: WinterParkingBan | null;
  onOpen: () => void;
}) {
  // Only surface if the notice is recent — keeps a stale winter advisory from
  // loitering on the board in summer.
  if (!ban || !isRecent(ban.pubDate, 10)) return null;

  return (
    <WidgetCard title="Winter Parking" icon={<IconBus className="w-4 h-4" />} meta={formatRelative(ban.pubDate)} onOpen={onOpen}>
      <a href={ban.link} target="_blank" rel="noopener noreferrer" className="block group">
        <p className="text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {ban.title}
        </p>
        {ban.description && <p className="text-xs text-foreground/55 mt-1 line-clamp-3">{ban.description}</p>}
      </a>
    </WidgetCard>
  );
}

// ── have your say (civic engagement, compact) ───────────────────────────────

const CIVIC_CHANNELS = [
  { emoji: "🛠️", title: "Report a problem · 311", href: "https://www.halifax.ca/home/311" },
  { emoji: "💬", title: "Shape Your City", href: "https://www.shapeyourcityhalifax.ca/" },
  { emoji: "🏛️", title: "Find your Councillor", href: "https://www.halifax.ca/city-hall/districts-councillors" },
  { emoji: "📋", title: "Speak at Regional Council", href: "https://www.halifax.ca/city-hall/agendas-meetings-reports" },
];

export function CivicEngagementWidget() {
  return (
    <WidgetCard title="Have Your Say" icon={<IconLandmark className="w-4 h-4" />} meta="get involved">
      <ul className="space-y-2">
        {CIVIC_CHANNELS.map((c) => (
          <li key={c.title}>
            <a
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-foreground/75 hover:text-foreground group"
            >
              <span className="text-base shrink-0" aria-hidden>{c.emoji}</span>
              <span className="truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{c.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
