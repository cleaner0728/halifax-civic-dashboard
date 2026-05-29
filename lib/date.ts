// Date/time helpers — Halifax local time (Atlantic / DST-aware) and relative
// duration formatting used across the dashboard.

export const HFX_TZ = 'America/Halifax';

// Constructing an Intl.DateTimeFormat is expensive (it does locale
// negotiation up front); `.format()` is cheap. toHfxDateStr is the hottest
// date helper — EventsFeed alone calls it a few times per event on every
// filter re-render — so we build the formatter once and reuse it. Reusing a
// formatter instance for repeated formatting is safe.
const hfxDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: HFX_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toHfxDateStr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return hfxDateFmt.format(d);
}

export function isSameDay(dateStr: string, target: Date): boolean {
  return toHfxDateStr(dateStr) === toHfxDateStr(target);
}

export function getDayName(dateStr: string): string {
  const now = new Date();
  const todayStr = toHfxDateStr(now);
  const tomorrowStr = toHfxDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: HFX_TZ });
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: HFX_TZ,
  });
}

// Format a naive local-time ISO ("2026-05-22T05:42") as "5:42 AM".
// Used for Open-Meteo sunrise/sunset, which arrive without a timezone
// offset (we request timezone=America/Halifax). Parsing through Date()
// would reinterpret those strings in the viewer's browser timezone, so a
// user in Vancouver would see Halifax sunrise shifted by 4 hours. Pull
// HH:MM out of the string directly to keep the value timezone-stable.
export function formatTime(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return iso;
  const hours = parseInt(m[1], 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `${h12}:${m[2]} ${period}`;
}

// Format a UTC ISO string as Halifax local time ("8:42 PM").
// Used for ECCC sunrise/sunset which are proper UTC timestamps.
export function formatUtcAsHfxTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: HFX_TZ,
  });
}

// Unified timestamp formatter for feed-style content. Tuned so the same
// rule reads naturally regardless of how recent the item is:
//   - first minute    → "just now"
//   - within 1 hour   → "5m ago"
//   - within 24 hours → "3h ago"
//   - within 7 days   → "Tue 5:42 PM" (Halifax local)
//   - older           → "May 18" (Halifax local)
//
// Accepts an ISO string OR a millisecond timestamp (Date.now() shape).
// For unix-seconds sources (Reddit's createdUtc) multiply by 1000 at the
// call site — that's an explicit conversion the reader can see.
export function formatRelative(input: string | number | undefined | null): string {
  if (input == null || input === '') return '';
  const ms = typeof input === 'number' ? input : new Date(input).getTime();
  if (!Number.isFinite(ms)) return '';

  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  const d = new Date(ms);
  if (diff < 7 * 86_400_000) {
    return d.toLocaleString('en-US', {
      timeZone: HFX_TZ,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return d.toLocaleDateString('en-US', {
    timeZone: HFX_TZ,
    month: 'short',
    day: 'numeric',
  });
}
