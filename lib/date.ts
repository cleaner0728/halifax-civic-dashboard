// Date/time helpers — Halifax local time (Atlantic / DST-aware) and relative
// duration formatting used across the dashboard.

export const HFX_TZ = 'America/Halifax';

export function toHfxDateStr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HFX_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function isSameDay(dateStr: string, target: Date): boolean {
  return toHfxDateStr(dateStr) === toHfxDateStr(target);
}

export function getDayName(dateStr: string): string {
  const now = new Date();
  const todayStr = toHfxDateStr(now);
  const tomorrowStr = toHfxDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'TMR';
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

export function timeAgo(utcSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000 - utcSeconds);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
