import type { HrmItem } from '@/lib/fetchers/hrm';
import { formatRelative } from '@/lib/date';
import { IconCheck } from '@/components/icons';

type IconSpec = { icon: string; bg: string };

const ICON_RULES: Array<[RegExp, IconSpec]> = [
  [/structure\s*fire|fire\s*structure/i, { icon: '🏚️', bg: 'bg-red-500/15' }],
  [/vehicle\s*fire/i, { icon: '🚗', bg: 'bg-red-500/15' }],
  [/outside\s*fire|grass|brush|wild\s*fire/i, { icon: '🌲', bg: 'bg-orange-500/15' }],
  [/motor\s*vehicle|collision|mvc/i, { icon: '💥', bg: 'bg-amber-500/15' }],
  [/medical|ems|cardiac/i, { icon: '🚑', bg: 'bg-blue-500/15' }],
  [/hazmat|hazardous/i, { icon: '☣️', bg: 'bg-emerald-500/15' }],
  [/rescue/i, { icon: '🆘', bg: 'bg-red-500/15' }],
  [/alarm/i, { icon: '🚨', bg: 'bg-yellow-500/15' }],
  [/smoke/i, { icon: '💨', bg: 'bg-slate-500/15' }],
  [/fire/i, { icon: '🔥', bg: 'bg-red-500/15' }],
];

const DEFAULT_ICON: IconSpec = { icon: '🚒', bg: 'bg-red-500/15' };

function getIncidentIcon(title?: string): IconSpec {
  if (!title) return DEFAULT_ICON;
  for (const [re, spec] of ICON_RULES) {
    if (re.test(title)) return spec;
  }
  return DEFAULT_ICON;
}

function parseLocation(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/Location:\s*(.+?)(?:\n|$)/i);
  return match ? match[1].trim() : null;
}

export default function HrfeBlock({ incidents }: { incidents: HrmItem[] }) {
  if (incidents.length === 0) {
    // Per design spec: show explicit placeholder rather than hiding the
    // section. "Quiet right now" is information; an empty space is not.
    return (
      <div className="flex flex-col items-center rounded-xl border border-border bg-card/60 text-center py-10 text-foreground/50">
        <IconCheck className="w-8 h-8 mb-2 text-emerald-500/70" />
        <p className="text-base font-medium">No active incidents in the past 60 minutes.</p>
        <p className="text-sm mt-1 text-foreground/40">All clear in the Halifax region.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {incidents.map((item, index) => {
        const { icon, bg } = getIncidentIcon(item.title);
        const location = parseLocation(item.description);
        return (
          <a
            key={index}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-card rounded-xl border border-border hover:border-red-500/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
          >
            <div className="p-3 flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center text-2xl shrink-0`}
                aria-hidden
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground leading-snug">
                  {item.title}
                  {location && (
                    <>
                      <br />
                      <span className="text-foreground/50 font-normal">{location}</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-foreground/40 mt-0.5 font-mono">
                  {formatRelative(item.pubDate) || 'Unknown'}
                </p>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
