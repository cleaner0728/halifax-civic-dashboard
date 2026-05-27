import type { TransitDetour, FerryAlert, TransitAdjustment } from '@/lib/fetchers/transit';

const DISRUPTIONS_URL = 'https://www.halifax.ca/transportation/halifax-transit/service-disruptions';

type Props = {
  detours: TransitDetour[];
  ferryAlerts: FerryAlert[];
  adjustments: TransitAdjustment | null;
};

function RoutePill({ route }: { route: string }) {
  return (
    <span className="inline-block whitespace-nowrap bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md px-2 py-0.5 text-sm font-mono font-bold align-baseline mx-0.5">
      {route}
    </span>
  );
}

function highlightRoutes(text: string): React.ReactNode {
  const re = /\bRoutes?\s+(\d+[A-Z]?(?:(?:\s*,\s*|\s+and\s+)\d+[A-Z]?)*)\b/g;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) nodes.push(text.slice(lastIdx, match.index));
    const fullMatch = match[0];
    const numbersStr = match[1];
    const word = fullMatch.slice(0, fullMatch.indexOf(numbersStr)).trimEnd();
    nodes.push(`${word} `);
    const parts = numbersStr.split(/(\s*,\s*|\s+and\s+)/);
    parts.forEach((part, i) => {
      if (/^\d+[A-Z]?$/.test(part)) {
        nodes.push(<RoutePill key={`${match!.index}-${i}`} route={part} />);
      } else {
        nodes.push(part);
      }
    });
    lastIdx = match.index + fullMatch.length;
  }
  if (lastIdx < text.length) nodes.push(text.slice(lastIdx));
  return <>{nodes}</>;
}

// Reusable collapsible card. Native <details>/<summary> for free a11y
// (keyboard, screen reader expand/collapse semantics) — no React state.
// Default closed: dashboard users should be able to scan section titles
// without being walled in by long detour descriptions.
function CollapsibleCard({
  icon,
  title,
  headerBgClass,
  headerBorderClass,
  children,
}: {
  icon: string;
  title: React.ReactNode;
  headerBgClass: string;
  headerBorderClass: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <summary
        className={`list-none cursor-pointer px-4 py-3 ${headerBgClass} border-b ${headerBorderClass} flex items-center gap-2 [&::-webkit-details-marker]:hidden`}
      >
        <span className="text-xl shrink-0" aria-hidden>{icon}</span>
        <h3 className="font-bold text-foreground leading-snug flex-1 min-w-0">{title}</h3>
        <svg
          className="w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="p-4 space-y-3 border-t border-transparent">{children}</div>
    </details>
  );
}

function SourceLink({
  href,
  label,
  colorClass,
}: {
  href: string;
  label: string;
  colorClass: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group/link inline-flex items-center text-sm ${colorClass} hover:underline`}
    >
      {label}
      <span aria-hidden className="inline-block ml-1 transition-transform group-hover/link:translate-x-0.5">↗</span>
    </a>
  );
}

export default function GettingAroundBlock({ detours, ferryAlerts, adjustments }: Props) {
  const empty = !adjustments && ferryAlerts.length === 0 && detours.length === 0;
  return (
    <div className="space-y-3">
      {adjustments && (
        <CollapsibleCard
          icon="📅"
          title={<>Upcoming Service Changes · {adjustments.dateLabel}</>}
          headerBgClass="bg-amber-500/10"
          headerBorderClass="border-amber-500/20"
        >
          {adjustments.intro && (
            <p className="text-sm text-foreground/80 leading-relaxed">
              {highlightRoutes(adjustments.intro)}
            </p>
          )}
          {adjustments.bullets.length > 0 && (
            <ul className="list-disc pl-5 space-y-2 text-sm text-foreground/70 leading-relaxed">
              {adjustments.bullets.map((b, i) => (
                <li key={i}>{highlightRoutes(b)}</li>
              ))}
            </ul>
          )}
          <SourceLink
            href={adjustments.sourceUrl}
            label="Full route-by-route details on halifax.ca"
            colorClass="text-amber-600 dark:text-amber-400"
          />
        </CollapsibleCard>
      )}

      {ferryAlerts.map((alert, i) => {
        const href = alert.moreDetailsUrl ?? DISRUPTIONS_URL;
        return (
          <CollapsibleCard
            key={alert.moreDetailsUrl ?? `ferry-${i}`}
            icon="⛴️"
            title={alert.title}
            headerBgClass="bg-sky-500/10"
            headerBorderClass="border-sky-500/20"
          >
            {alert.body && (
              <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-line">
                {highlightRoutes(alert.body)}
              </p>
            )}
            <SourceLink
              href={href}
              label={alert.moreDetailsUrl ? 'More details on halifax.ca' : 'Source: halifax.ca'}
              colorClass="text-sky-600 dark:text-sky-400"
            />
          </CollapsibleCard>
        );
      })}

      {detours.map((detour, index) => (
        <CollapsibleCard
          key={`${detour.title}-${index}`}
          icon="🚌"
          title={detour.title}
          headerBgClass="bg-amber-500/10"
          headerBorderClass="border-amber-500/20"
        >
          <div className="flex flex-wrap gap-6">
            {(detour.date || detour.startDate) && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                  {detour.startDate ? 'Start Date' : 'Date'}
                </div>
                <div className="text-xl font-bold text-foreground">
                  📅 {detour.startDate ?? detour.date}
                </div>
              </div>
            )}
            {detour.endDate && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                  End Date
                </div>
                <div className="text-xl font-bold text-foreground">📅 {detour.endDate}</div>
              </div>
            )}
            {detour.time && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-0.5">
                  Time
                </div>
                <div className="text-xl font-bold text-amber-500 dark:text-amber-400">⏰ {detour.time}</div>
              </div>
            )}
          </div>
          {detour.location && <p className="text-sm text-foreground/60">📍 {detour.location}</p>}
          {detour.routes && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/40 mb-2">
                Affected Routes
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detour.routes
                  .split(',')
                  .map((r) => r.trim())
                  .filter(Boolean)
                  .map((route) => (
                    <span
                      key={route}
                      className="inline-block bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-md px-2.5 py-0.5 text-base font-mono font-bold"
                    >
                      {route}
                    </span>
                  ))}
              </div>
            </div>
          )}
          {detour.summary && (
            <p className="text-sm text-foreground/50 leading-relaxed border-t border-border/50 pt-3">
              {highlightRoutes(detour.summary)}
            </p>
          )}
          <SourceLink
            href={DISRUPTIONS_URL}
            label="Source: halifax.ca"
            colorClass="text-amber-600 dark:text-amber-400"
          />
        </CollapsibleCard>
      ))}

      {empty && (
        <div className="text-center py-10 text-foreground/40">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-base font-medium">No active transit disruptions.</p>
          <p className="text-sm mt-1">Halifax Transit is running on regular routes.</p>
        </div>
      )}
    </div>
  );
}
