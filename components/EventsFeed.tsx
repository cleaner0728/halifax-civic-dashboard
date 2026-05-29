'use client';

import { useState } from 'react';
import type { HalifaxEvent } from '@/lib/fetchers/events';
import { HFX_TZ, toHfxDateStr } from '@/lib/date';
import { IconPin, IconInbox } from '@/components/icons';

// ── Category styling ────────────────────────────────────────────────────────

// Chips are neutral now; the only colour is a small per-category dot for
// at-a-glance scanning. Keeps the feed calm instead of a rainbow of filled
// pills.
const CAT_DOT: Record<string, string> = {
  'Free':                'bg-emerald-500',
  'Music':               'bg-blue-500',
  'Arts & Culture':      'bg-violet-500',
  'Food & Drink':        'bg-orange-500',
  'Family-Friendly':     'bg-green-500',
  'Comedy':              'bg-yellow-500',
  'Nightlife':           'bg-indigo-500',
  'Sports & Recreation': 'bg-sky-500',
  '2SLGBTQIA':           'bg-pink-500',
  'History':             'bg-amber-500',
};
const CAT_DOT_DEFAULT = 'bg-foreground/30';

function catDot(cat: string) {
  return CAT_DOT[cat] ?? CAT_DOT_DEFAULT;
}

// A "duration" event runs across multiple days. The scraper records this in
// date_text as a range ("Dec 31, 2025 - Dec 31, 2027"); a single day has no
// " - ". Fall back to comparing start/end calendar days if date_text is
// missing.
function isDurationEvent(ev: { date_text: string | null; start_at: string; end_at: string | null }): boolean {
  if (ev.date_text) return ev.date_text.includes(' - ');
  return ev.end_at ? toHfxDateStr(ev.end_at) !== toHfxDateStr(ev.start_at) : false;
}

// ── Time helpers ─────────────────────────────────────────────────────────────

// Build a cross-platform maps link. The Google Maps universal URL opens the
// native Maps app on mobile (Google Maps on Android; Google Maps or the
// browser → Apple Maps on iOS) and the web map on desktop. We query by
// venue name + full address for the most accurate pin.
function venueMapUrl(name: string | null, address: string | null): string {
  const query = [name, address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatEventTime(timeText: string | null): string {
  if (!timeText) return '';
  if (timeText.replace(/\s/g, '') === '12:00am-12:00am') return 'All Day';
  return timeText;
}

function formatEndDate(startAt: string, endAt: string | null): string | null {
  if (!endAt) return null;
  const startDay = toHfxDateStr(startAt);
  const endDay   = toHfxDateStr(endAt);
  if (endDay === startDay) return null; // same day — time_text already covers it
  const d = new Date(endDay + 'T12:00:00');
  return 'Ends ' + d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: HFX_TZ,
  });
}

function formatDateHeader(dateStr: string): string {
  const now   = new Date();
  const today = toHfxDateStr(now);
  const tmrw  = toHfxDateStr(new Date(now.getTime() + 86_400_000));
  const d     = new Date(dateStr + 'T12:00:00');
  const long  = d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: HFX_TZ,
  });
  if (dateStr === today) return `Today · ${long}`;
  if (dateStr === tmrw)  return `Tomorrow · ${long}`;
  return long;
}

// ── Derived category list (from events, sorted by count) ────────────────────

function topCategories(events: HalifaxEvent[]): string[] {
  const counts = new Map<string, number>();
  for (const ev of events) {
    for (const c of ev.categories ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)
    .slice(0, 9);
}

// ── Single event card ─────────────────────────────────────────────────────────

function EventCard({ ev }: { ev: HalifaxEvent }) {
  // Multi-day runs show their full date_text range ("Dec 31, 2025 - Dec 31,
  // 2027"); single-day events get the friendly relative header ("Today ·
  // Friday, May 29").
  const dateDisplay = isDurationEvent(ev) && ev.date_text
    ? ev.date_text
    : formatDateHeader(toHfxDateStr(ev.start_at));
  const timeDisplay = formatEventTime(ev.time_text);
  const endDisplay  = formatEndDate(ev.start_at, ev.end_at);
  const hasSocials  = ev.facebook_url || ev.instagram_url || ev.twitter_url;

  return (
    <article className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-4 space-y-2">

        {/* Date — always shown, top-left first position */}
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
          {dateDisplay}
        </p>

        {/* Time + End date */}
        {(timeDisplay || endDisplay) && (
          <p className="text-xs font-mono text-foreground/50 uppercase tracking-wide flex items-center gap-2">
            {timeDisplay && <span>{timeDisplay}</span>}
            {endDisplay  && <span className="text-foreground/40">{endDisplay}</span>}
          </p>
        )}

        {/* Title */}
        <h3 className="text-base font-semibold text-foreground leading-snug">
          {ev.title}
        </h3>

        {/* Organizer */}
        {ev.organizer_name && (
          <p className="text-xs text-foreground/50">{ev.organizer_name}</p>
        )}

        {/* Venue — tap to open in Maps */}
        {ev.venue_name && (
          <a
            href={venueMapUrl(ev.venue_name, ev.venue_address)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${ev.venue_name} in Maps`}
            className="text-sm text-foreground/70 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-start gap-1.5 group"
          >
            <IconPin className="w-4 h-4 shrink-0 mt-0.5 text-foreground/40" />
            <span className="group-hover:underline">
              {ev.venue_name}{ev.venue_address ? ` · ${ev.venue_address.split(',').slice(0, 2).join(',')}` : ''}
            </span>
          </a>
        )}

        {/* Price */}
        {ev.price_range && (
          <p className="text-sm text-foreground/70">{ev.price_range}</p>
        )}

        {/* Summary */}
        {ev.summary && (
          <p className="text-sm text-foreground/60 line-clamp-2">{ev.summary}</p>
        )}

        {/* Category chips — neutral with a small per-category dot */}
        {ev.categories?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ev.categories.map(cat => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md bg-foreground/[0.06] text-foreground/60"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${catDot(cat)}`} />
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="border-t border-border px-4 py-2.5 flex items-center gap-2 flex-wrap">
        {ev.tickets_url && (
          <a
            href={ev.tickets_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Get Tickets ↗
          </a>
        )}
        {ev.website && (
          <a
            href={ev.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-foreground/5 text-foreground/70 transition-colors"
          >
            Website ↗
          </a>
        )}

        {/* Social icons — right side */}
        {hasSocials && (
          <div className="ml-auto flex items-center gap-2">
            {ev.facebook_url && (
              <a href={ev.facebook_url} target="_blank" rel="noopener noreferrer"
                className="text-foreground/40 hover:text-blue-500 transition-colors text-sm"
                aria-label="Facebook">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
            )}
            {ev.instagram_url && (
              <a href={ev.instagram_url} target="_blank" rel="noopener noreferrer"
                className="text-foreground/40 hover:text-pink-500 transition-colors"
                aria-label="Instagram">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                </svg>
              </a>
            )}
            {ev.twitter_url && (
              <a href={ev.twitter_url} target="_blank" rel="noopener noreferrer"
                className="text-foreground/40 hover:text-foreground transition-colors"
                aria-label="X / Twitter">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.727-8.826L1.254 2.25H8.08l4.261 5.638 5.904-5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

// ── Main exported component ──────────────────────────────────────────────────

type Props = { events: HalifaxEvent[] };

type DateFilter = 'today' | '3days' | null;

export default function EventsFeed({ events }: Props) {
  const [activeCat, setActiveCat]   = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  const cats = topCategories(events);

  const _now        = new Date();
  const todayStr    = toHfxDateStr(_now);
  const _1d         = new Date(_now); _1d.setDate(_now.getDate() + 1);
  const tomorrowStr = toHfxDateStr(_1d);
  const _3d         = new Date(_now); _3d.setDate(_now.getDate() + 3);
  const in3DaysStr  = toHfxDateStr(_3d);

  const filtered = events.filter(ev => {
    const startStr = toHfxDateStr(ev.start_at);
    const endStr   = ev.end_at ? toHfxDateStr(ev.end_at) : startStr;
    // "Today only": event is on today — it started on/before today and
    // ends on/after today. Catches multi-day runs (exhibits, festivals)
    // that opened earlier but are still on, not just events starting today.
    if (dateFilter === 'today'  && (startStr > todayStr || endStr < todayStr)) return false;
    // "Next 3 days": the window is tomorrow .. today+3 (today itself is the
    // "Today only" filter's job). Show an event if it overlaps that window —
    // starts on/before today+3 AND ends on/after tomorrow. The end>=tomorrow
    // half drops anything that's already over by the end of today.
    if (dateFilter === '3days'  && (startStr > in3DaysStr || endStr < tomorrowStr)) return false;
    if (activeCat && !ev.categories?.includes(activeCat))  return false;
    return true;
  });

  // Order: single-day events first (by start time), then multi-day
  // "duration" events (exhibits, festival runs) below them, sorted by
  // when they end. Without this, a months-long run sorts by its early
  // start date and floats to the very top, burying the events that are
  // actually happening today.
  const ordered = filtered
    .map((ev) => {
      const startMs = new Date(ev.start_at).getTime();
      const endMs = ev.end_at ? new Date(ev.end_at).getTime() : startMs;
      return { ev, isDuration: isDurationEvent(ev), startMs, endMs };
    })
    .sort((a, b) => {
      if (a.isDuration !== b.isDuration) return a.isDuration ? 1 : -1;
      return a.isDuration ? a.endMs - b.endMs : a.startMs - b.startMs;
    })
    .map((d) => d.ev);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 text-foreground/40">
        <IconInbox className="w-9 h-9 mb-3 text-foreground/25" />
        <p className="text-base font-medium">No upcoming events found.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Date-range presets — left of All */}
        <button
          onClick={() => setDateFilter(dateFilter === 'today' ? null : 'today')}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            dateFilter === 'today'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-border text-foreground/60 hover:bg-foreground/5'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setDateFilter(dateFilter === '3days' ? null : '3days')}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            dateFilter === '3days'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-border text-foreground/60 hover:bg-foreground/5'
          }`}
        >
          Next 3 days
        </button>

        {/* All — clears both date and category */}
        <button
          onClick={() => { setActiveCat(null); setDateFilter(null); }}
          className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            activeCat === null && dateFilter === null
              ? 'bg-blue-600 text-white border-blue-600'
              : 'border-border text-foreground/60 hover:bg-foreground/5'
          }`}
        >
          All
        </button>

        {/* Category pills */}
        {cats.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(activeCat === cat ? null : cat)}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              activeCat === cat
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-border text-foreground/60 hover:bg-foreground/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-foreground/40 mb-4">
        {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        {dateFilter === 'today' ? ' · Today' : dateFilter === '3days' ? ' · Next 3 days' : ''}
        {activeCat ? ` · ${activeCat}` : ''}
      </p>

      {/* Flat event list — each card carries its own date (top-left) */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-foreground/40">
          <p className="text-base">No events in this category.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map(ev => (
            <EventCard key={ev.url} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
