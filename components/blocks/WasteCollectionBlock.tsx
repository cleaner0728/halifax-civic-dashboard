'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconTrash } from '@/components/icons';
import CollapsibleSection from '@/components/CollapsibleSection';
import {
  AREAS,
  HOLIDAYS_2026,
  nextPickup,
  pickupsInRange,
  type Area,
  type CollectionDow,
  type Stream,
} from '@/lib/data/waste-2026';

// Self-contained <details>-based section so the chevron header matches the
// other CollapsibleSection blocks on the City Live screen, but the meta
// slot can show a dynamic "Next: Thu Jun 4" once localStorage hydrates.
// The body and header live in one client component because both depend on
// the same persisted prefs (chosen area + day-of-week).

const STORAGE_KEY = 'hfx-waste-prefs-v1';

const DOW_LABELS: Record<CollectionDow, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

const STREAM_CHIP: Record<Stream, { label: string; cls: string; dot: string }> = {
  organics: {
    label: 'Organics',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  recycling: {
    label: 'Recycling',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/25',
    dot: 'bg-sky-500',
  },
  garbage: {
    label: 'Garbage',
    cls: 'bg-stone-500/15 text-stone-700 dark:text-stone-300 ring-1 ring-stone-500/25',
    dot: 'bg-stone-500',
  },
};

type Prefs = { area: Area; dow: CollectionDow };

function isPrefs(value: unknown): value is Prefs {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.area !== 'I' && v.area !== 'II') return false;
  if (typeof v.dow !== 'number' || !Number.isInteger(v.dow) || v.dow < 1 || v.dow > 5) return false;
  return true;
}

export default function WasteCollectionBlock() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  // Editing flag is separate from prefs so clicking Edit can show the form
  // pre-filled with the current values without first wiping them.
  const [editing, setEditing] = useState(false);
  // Avoid rendering different markup on server vs first client paint: we
  // don't know the saved area until the effect runs, so the initial server
  // render and first client render both show the neutral header.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isPrefs(parsed)) setPrefs(parsed);
      }
    } catch {
      // localStorage can throw in private browsing — fall through to setup state.
    }
    setHydrated(true);
  }, []);

  const savePrefs = (next: Prefs) => {
    setPrefs(next);
    setEditing(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const next = useMemo(() => (prefs ? nextPickup(prefs.area, prefs.dow) : null), [prefs]);

  // Render section header meta (right side of header row).
  const metaText = (() => {
    if (!hydrated || !prefs || !next) return null;
    const d = new Date(`${next.date}T12:00:00`);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Next: ${weekday} ${monthDay}`;
  })();

  return (
    <CollapsibleSection
      id="waste"
      icon={<IconTrash className="w-5 h-5" />}
      title="Waste Collection"
      meta={metaText ?? undefined}
      href="https://www.halifax.ca/home-property/garbage-recycling-green-cart"
      linkLabel="halifax.ca/recycle"
    >
      {!hydrated ? (
        <CardShell>
          <div className="px-4 py-6 text-xs text-foreground/40">Loading your schedule…</div>
        </CardShell>
      ) : prefs && !editing && next ? (
        <ActiveCard prefs={prefs} onEdit={() => setEditing(true)} />
      ) : (
        <SetupCard
          initial={prefs}
          onSave={savePrefs}
          onCancel={prefs ? () => setEditing(false) : undefined}
        />
      )}
    </CollapsibleSection>
  );
}

// ─── Setup state ─────────────────────────────────────────────────────────

function SetupCard({
  initial,
  onSave,
  onCancel,
}: {
  initial: Prefs | null;
  onSave: (p: Prefs) => void;
  onCancel?: () => void;
}) {
  const [area, setArea] = useState<Area | ''>(initial?.area ?? '');
  const [dow, setDow] = useState<CollectionDow | ''>(initial?.dow ?? '');

  const canSave = area !== '' && dow !== '';

  return (
    <CardShell>
      <div className="px-4 pt-4 pb-4">
        <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-medium flex items-center gap-1.5">
          <IconTrash className="w-3.5 h-3.5" />
          Waste Collection
        </p>
        <p className="text-sm text-foreground/70 mt-2">
          {initial
            ? 'Update your collection area or pickup day.'
            : 'Pick your collection area and pickup day to see your schedule.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-foreground/50 font-medium mb-1">
              Area
            </span>
            <select
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-foreground/20"
              value={area}
              onChange={e => setArea(e.target.value as Area | '')}
            >
              <option value="">Select…</option>
              <option value="I">Area I — {AREAS.I.shortDescription}</option>
              <option value="II">Area II — {AREAS.II.shortDescription}</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-foreground/50 font-medium mb-1">
              Pickup day
            </span>
            <select
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-foreground/20"
              value={dow}
              onChange={e => setDow(e.target.value === '' ? '' : (Number(e.target.value) as CollectionDow))}
            >
              <option value="">Select…</option>
              <option value={1}>Monday</option>
              <option value={2}>Tuesday</option>
              <option value={3}>Wednesday</option>
              <option value={4}>Thursday</option>
              <option value={5}>Friday</option>
            </select>
          </label>
        </div>

        {area && (
          <p className="text-[11px] text-foreground/45 mt-3">
            Communities in {AREAS[area].label}: {AREAS[area].neighborhoods.slice(0, 6).join(', ')}…{' '}
            <span className="text-foreground/35">{AREAS[area].fallback}</span>
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => canSave && onSave({ area: area as Area, dow: dow as CollectionDow })}
            className="rounded-lg bg-foreground text-background text-sm font-semibold px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Save schedule
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border text-foreground/70 text-sm font-medium px-4 py-2 hover:bg-foreground/5 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </CardShell>
  );
}

// ─── Active state ────────────────────────────────────────────────────────

function ActiveCard({ prefs, onEdit }: { prefs: Prefs; onEdit: () => void }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const next = useMemo(() => nextPickup(prefs.area, prefs.dow, today), [prefs, today]);
  const upcoming = useMemo(
    () => pickupsInRange(prefs.area, prefs.dow, today, 42),
    [prefs, today],
  );

  const nextDate = new Date(`${next.date}T12:00:00`);
  const daysAhead = Math.round((nextDate.getTime() - today.getTime()) / 86_400_000);
  const dayPhrase =
    daysAhead === 0 ? 'today' : daysAhead === 1 ? 'tomorrow' : `in ${daysAhead} days`;
  const weekday = nextDate.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = nextDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <CardShell>
      <div className="px-4 pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-medium flex items-center gap-1.5">
              <IconTrash className="w-3.5 h-3.5" />
              Waste Collection
            </p>
            <p className="text-[10px] text-foreground/40 mt-0.5">
              {AREAS[prefs.area].label} · {DOW_LABELS[prefs.dow]} pickup
            </p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] text-foreground/45 hover:text-foreground/80 shrink-0 -mt-0.5 px-1.5 py-0.5 rounded hover:bg-foreground/5 transition-colors"
            aria-label="Change area and pickup day"
          >
            Edit
          </button>
        </div>

        <div className="mt-3">
          <p className="text-[11px] uppercase tracking-wider text-foreground/50 font-medium">
            Next pickup
          </p>
          <div className="flex items-baseline gap-2 mt-1 flex-wrap">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {weekday}, {monthDay}
            </span>
            <span className={`text-sm font-semibold ${daysAhead <= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground/50'}`}>
              {dayPhrase}
            </span>
          </div>
          {next.isShifted && next.shiftReason && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Shifted from {formatShortDate(next.shiftedFrom!)} for {next.shiftReason}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          {next.streams.map(s => (
            <StreamChip key={s} stream={s} />
          ))}
        </div>

        {next.giveaway && (
          <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-3 flex items-start gap-1.5">
            <span aria-hidden>★</span>
            <span>
              <strong>{next.giveaway.label}</strong>: set out reusable items by the curb this
              weekend ({formatShortDate(next.giveaway.start)}–{formatShortDate(next.giveaway.end)}).
            </span>
          </p>
        )}

        <p className="text-[11px] text-foreground/45 mt-3">
          Set out the night before, by 7 AM.
        </p>

        <MiniMonth
          today={today}
          upcoming={upcoming}
        />
      </div>
    </CardShell>
  );
}

function StreamChip({ stream }: { stream: Stream }) {
  const cfg = STREAM_CHIP[stream];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </span>
  );
}

// 6-week mini-calendar showing upcoming pickup dates. Each row is a week.
// Pickup days are highlighted with stream-colored dots, the user's chosen
// day is outlined, holidays are red, today is bold.
function MiniMonth({
  today,
  upcoming,
}: {
  today: Date;
  upcoming: Array<{ date: string; streams: Stream[]; isShifted: boolean }>;
}) {
  const pickupMap = useMemo(() => {
    const m = new Map<string, { streams: Stream[]; isShifted: boolean }>();
    upcoming.forEach(p => m.set(p.date, p));
    return m;
  }, [upcoming]);

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    HOLIDAYS_2026.forEach(h => m.set(h.date, h.name));
    return m;
  }, []);

  // 6 weeks starting from this week's Monday.
  const startMon = mondayOf(today);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(startMon);
      day.setDate(day.getDate() + w * 7 + d);
      row.push(day);
    }
    weeks.push(row);
  }

  const todayIso = isoOf(today);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-widest text-foreground/50 font-medium">
          Next 6 weeks
        </p>
        <div className="flex items-center gap-2.5 text-[10px] text-foreground/50">
          {(['organics', 'recycling', 'garbage'] as Stream[]).map(s => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STREAM_CHIP[s].dot}`} aria-hidden />
              {STREAM_CHIP[s].label}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-foreground/40 mb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((row, i) => (
          <div key={i} className="grid grid-cols-7 gap-1">
            {row.map(day => {
              const iso = isoOf(day);
              const pickup = pickupMap.get(iso);
              const holiday = holidayMap.get(iso);
              const isToday = iso === todayIso;
              const dayNum = day.getDate();
              const isFirstOfMonth = dayNum === 1;
              return (
                <div
                  key={iso}
                  className={`relative rounded-md py-1 text-[11px] tabular-nums ${
                    isToday
                      ? 'bg-foreground/10 font-bold text-foreground'
                      : holiday
                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      : pickup
                      ? 'bg-foreground/[0.03] text-foreground'
                      : 'text-foreground/35'
                  }`}
                  title={
                    holiday
                      ? `${holiday} — no collection`
                      : pickup
                      ? `Pickup: ${pickup.streams.join(' + ')}${pickup.isShifted ? ' (shifted)' : ''}`
                      : undefined
                  }
                >
                  <div className="text-center">{isFirstOfMonth ? `${day.toLocaleDateString('en-US', { month: 'short' })} 1` : dayNum}</div>
                  {pickup && (
                    <div className="flex items-center justify-center gap-0.5 mt-0.5">
                      {pickup.streams.map(s => (
                        <span
                          key={s}
                          className={`w-1.5 h-1.5 rounded-full ${STREAM_CHIP[s].dot}`}
                          aria-hidden
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared chrome ──────────────────────────────────────────────────────

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

// ─── Date helpers ────────────────────────────────────────────────────────

function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function isoOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
