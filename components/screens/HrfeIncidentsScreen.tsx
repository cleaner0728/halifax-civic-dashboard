import type { HrmItem } from '@/lib/fetchers/hrm';

// HRFE incident titles are short, all-caps category labels like
// "MEDICAL ASSISTANCE", "VEHICLE FIRE", "MOTOR VEHICLE COLLISION".
// Match most-specific patterns FIRST so e.g. "VEHICLE FIRE" doesn't get
// swallowed by a generic /vehicle/ rule before /vehicle\s*fire/ runs.
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

// Pull the location line out of the RSS description, which looks like:
//   "Location: 123 Main St, Halifax\nCall Type: Medical\nResponse: 2 Units"
function parseLocation(description?: string): string | null {
  if (!description) return null;
  const match = description.match(/Location:\s*(.+?)(?:\n|$)/i);
  return match ? match[1].trim() : null;
}

export default function HrfeIncidentsScreen({ incidents }: { incidents: HrmItem[] }) {
  return (
    <div className="pt-20 pb-4 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-red-500 via-orange-600 to-amber-600 dark:from-red-800 dark:via-orange-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
                Halifax Regional Fire &amp; Emergency
              </p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">HRFE Incidents</h2>
              <p className="text-base text-white/70 mt-1">
                Past 6 hours · {incidents.length} incident{incidents.length !== 1 ? 's' : ''} ·{' '}
                <a
                  href="https://www.halifax.ca/safety-security/fire-emergency/hrfe-incident-feed"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  HRFE Incident Feed
                </a>
              </p>
            </div>
            <div className="text-5xl">🚒</div>
          </div>
        </div>

        <div className="space-y-3 pb-16">
          {incidents.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">✅</p>
              <p className="text-lg font-medium">No active incidents.</p>
              <p className="text-sm mt-1">All clear in the Halifax region.</p>
            </div>
          ) : (
            incidents.map((item, index) => {
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
                        {item.pubDate
                          ? new Date(item.pubDate).toLocaleString('en-US', { timeZone: 'America/Halifax' })
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
