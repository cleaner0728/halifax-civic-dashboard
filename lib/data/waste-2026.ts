// Halifax HRM 2026 waste collection schedule. Source PDF:
// https://cdn.halifax.ca/sites/default/files/documents/home-property/garbage-recycling-green-cart/cc_hsw_wastecollectionschedule2026-print.pdf
//
// HRM splits the municipality into two collection AREAS (I and II) that share
// the same holiday calendar but alternate on opposite biweekly cycles — when
// Area I has Organics+Recycling, Area II has Garbage-only, and vice versa.
// Within each area, every neighborhood has a fixed Mon–Fri collection day.
// The PDF doesn't tell residents which day-of-week their street is on, only
// the week-by-week stream rotation for the whole area.
//
// During the summer green-cart trial (Jun 29 – Oct 2, 2026), the "garbage-only"
// weeks become "Organics + Garbage" weeks (organics is weekly rather than
// biweekly). The trial is "subject to council approval" per the PDF; if it's
// cancelled, all weeks during the window revert to plain garbage-only.

export type Area = 'I' | 'II';
export type Stream = 'organics' | 'recycling' | 'garbage';
// 1 = Monday … 5 = Friday. Residents only have collection on weekdays.
export type CollectionDow = 1 | 2 | 3 | 4 | 5;
// 'OR' = Organics + Recycling, 'OG' = Organics + Garbage, 'G' = Garbage only.
export type WeekKind = 'OR' | 'OG' | 'G';

export const AREAS: Record<Area, {
  label: string;
  shortDescription: string;
  neighborhoods: string[];
  fallback: string;
}> = {
  I: {
    label: 'Area I',
    shortDescription: 'Halifax peninsula, Cole Harbour, Sackville',
    neighborhoods: [
      'Halifax', 'Sackville', 'Beaver Bank', 'Cole Harbour', 'Eastern Passage',
      'Kinsac', 'Westphal', 'Cherry Brook', 'Fall River', 'Waverley', 'Cow Bay',
      'Shearwater', 'Windsor Junction', "Fletcher's Lake", 'Goffs', 'Wellington',
      'Grand Lake', 'Enfield', 'Oakfield', 'Dutch Settlement',
    ],
    fallback: 'If your community is not listed, check Area II or call 311.',
  },
  II: {
    label: 'Area II',
    shortDescription: 'Dartmouth, Bedford, Hammonds Plains, Tantallon',
    neighborhoods: [
      'Prospect', 'Dartmouth', 'Bedford', 'Stillwater Lake', 'Hammonds Plains',
      'Upper Hammonds Plains', 'Conrod Settlement', 'Lake Egmont', 'Elderbank',
      "Meagher's Grant", 'Preston', 'Dean', 'Tantallon', 'Mooseland', 'Tangier',
      'Sheet Harbour', 'Moser River', 'Upper Tantallon', 'Beechville', 'Lakeside',
      'Timberlea', 'Hubley', 'St. Margarets Bay', 'Hubbards', "Peggy's Cove",
      'Lawrencetown', 'Lake Echo', 'Harrietsfield', 'Herring Cove', 'Porters Lake',
      'Chezzetcook', 'Ecum Secum', 'Musquodoboit Valley',
    ],
    fallback: 'If your community is not listed, check Area I or call 311.',
  },
};

// Statutory holidays observed by HRM waste collection in 2026. A holiday on
// Mon–Fri shifts that day's collection (and every weekday after it in the
// same week) forward by one day, with Friday cascading to Saturday.
export const HOLIDAYS_2026: ReadonlyArray<{ date: string; name: string }> = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-16', name: 'Heritage Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-18', name: 'Victoria Day' },
  { date: '2026-07-01', name: 'Canada Day' },
  { date: '2026-08-03', name: 'Natal Day' },
  { date: '2026-09-07', name: 'Labour Day' },
  { date: '2026-10-12', name: 'Thanksgiving' },
  { date: '2026-11-11', name: 'Remembrance Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
];

// Curbside Giveaway Weekends — residents set out reusable items at the curb
// for anyone to take, on the Saturday/Sunday of these weekends.
export const GIVEAWAY_WEEKENDS_2026: ReadonlyArray<{
  start: string;
  end: string;
  label: string;
}> = [
  { start: '2026-06-06', end: '2026-06-07', label: 'Spring Curbside Giveaway' },
  { start: '2026-10-17', end: '2026-10-18', label: 'Fall Curbside Giveaway' },
];

// Summer weekly green-cart trial window — "subject to council approval per
// the PDF" — runs Jun 29 through Oct 2, 2026. During this window, the
// otherwise-garbage-only weeks gain an organics pickup.
const SUMMER_TRIAL_START = '2026-06-29';
const SUMMER_TRIAL_END = '2026-10-02';

// What's collected for a given area in the ISO week containing `dateInWeek`.
// Area I = ODD ISO weeks are Organics+Recycling, EVEN are Garbage(+Organics in
// summer trial). Area II is the inverse — the two areas mirror each other so
// HRM's trucks are evenly loaded across the biweekly cycle.
export function getWeekKind(area: Area, dateInWeek: Date): WeekKind {
  const isoWeek = isoWeekNumber(dateInWeek);
  const isAreaOnWeek = area === 'I' ? isoWeek % 2 === 1 : isoWeek % 2 === 0;
  if (isAreaOnWeek) return 'OR';
  return isInSummerTrial(dateInWeek) ? 'OG' : 'G';
}

// Convert a WeekKind into the actual streams set out that day. Used to render
// the chip badges on the card.
export function streamsFor(kind: WeekKind): Stream[] {
  if (kind === 'OR') return ['organics', 'recycling'];
  if (kind === 'OG') return ['organics', 'garbage'];
  return ['garbage'];
}

// Compute the next pickup date for a household. `normalDow` is the resident's
// usual Mon–Fri collection day. Walks forward from `from`, applying HRM's
// holiday-shift cascade (Thu holiday pushes Thu→Fri and Fri→Sat, Mon holiday
// pushes the whole week Tue→Sat, etc.).
export function nextPickup(
  area: Area,
  normalDow: CollectionDow,
  from: Date = new Date(),
): {
  date: string;
  streams: Stream[];
  kind: WeekKind;
  isShifted: boolean;
  shiftedFrom?: string;
  shiftReason?: string;
  giveaway?: { start: string; end: string; label: string };
} {
  // Search up to 60 days forward — comfortably more than two collection cycles
  // plus the largest possible holiday-shift gap.
  const today = startOfDay(from);
  for (let offset = 0; offset < 60; offset++) {
    const candidate = addDays(today, offset);
    const candidateDow = candidate.getDay(); // 0=Sun..6=Sat
    // Find what the actual pickup date is for someone whose normal day is
    // `normalDow` in the calendar week containing `candidate`.
    const weekMonday = mondayOf(candidate);
    const normalPickup = addDays(weekMonday, normalDow - 1);
    const shifted = applyHolidayShift(normalPickup);
    if (sameDay(shifted.actual, candidate) && candidate >= today) {
      const kind = getWeekKind(area, candidate);
      const isoDate = toIsoDate(candidate);
      return {
        date: isoDate,
        streams: streamsFor(kind),
        kind,
        isShifted: shifted.shifted,
        shiftedFrom: shifted.shifted ? toIsoDate(normalPickup) : undefined,
        shiftReason: shifted.reason,
        giveaway: giveawayCovering(isoDate),
      };
    }
  }
  // Pathological fallback — shouldn't be reachable for any 2026 date.
  return {
    date: toIsoDate(today),
    streams: streamsFor(getWeekKind(area, today)),
    kind: getWeekKind(area, today),
    isShifted: false,
  };
}

// Build a list of every pickup in `[from, from + days)` for a household, so the
// card can render a mini-month view. Each entry already accounts for holiday
// shifts.
export function pickupsInRange(
  area: Area,
  normalDow: CollectionDow,
  from: Date,
  days: number,
): Array<{
  date: string;
  streams: Stream[];
  kind: WeekKind;
  isShifted: boolean;
  shiftedFrom?: string;
  shiftReason?: string;
}> {
  const start = startOfDay(from);
  const end = addDays(start, days);
  const out: ReturnType<typeof pickupsInRange> = [];
  // For each calendar week intersecting the range, compute the household's
  // shifted pickup date and include it if it falls inside the range.
  let cursor = mondayOf(start);
  while (cursor < end) {
    const normalPickup = addDays(cursor, normalDow - 1);
    const shifted = applyHolidayShift(normalPickup);
    if (shifted.actual >= start && shifted.actual < end) {
      const kind = getWeekKind(area, shifted.actual);
      out.push({
        date: toIsoDate(shifted.actual),
        streams: streamsFor(kind),
        kind,
        isShifted: shifted.shifted,
        shiftedFrom: shifted.shifted ? toIsoDate(normalPickup) : undefined,
        shiftReason: shifted.reason,
      });
    }
    cursor = addDays(cursor, 7);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

const HOLIDAY_BY_DATE: Record<string, string> = Object.fromEntries(
  HOLIDAYS_2026.map(h => [h.date, h.name]),
);

// Apply HRM's holiday-shift cascade to a normal Mon–Fri collection date.
// Returns the actual date residents should set out, plus whether a shift
// happened and a human-readable reason.
function applyHolidayShift(normalDate: Date): {
  actual: Date;
  shifted: boolean;
  reason?: string;
} {
  // Look for holidays from Monday of this week up to and including the
  // normal pickup day. Each one shifts the pickup forward by 1.
  const weekMonday = mondayOf(normalDate);
  let shifts = 0;
  let reasons: string[] = [];
  // Day index 1..5 of normal pickup (1=Mon..5=Fri).
  const normalIdx = Math.round((normalDate.getTime() - weekMonday.getTime()) / 86_400_000) + 1;
  for (let i = 1; i <= normalIdx; i++) {
    const probe = addDays(weekMonday, i - 1);
    const probeIso = toIsoDate(probe);
    const name = HOLIDAY_BY_DATE[probeIso];
    if (name) {
      shifts++;
      reasons.push(name);
    }
  }
  if (shifts === 0) return { actual: normalDate, shifted: false };
  return {
    actual: addDays(normalDate, shifts),
    shifted: true,
    reason: reasons[0],
  };
}

function giveawayCovering(isoDate: string): { start: string; end: string; label: string } | undefined {
  return GIVEAWAY_WEEKENDS_2026.find(g => isoDate >= g.start && isoDate <= g.end);
}

function isInSummerTrial(date: Date): boolean {
  const iso = toIsoDate(date);
  return iso >= SUMMER_TRIAL_START && iso <= SUMMER_TRIAL_END;
}

// ISO 8601 week number (week 1 contains the year's first Thursday).
function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function mondayOf(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
