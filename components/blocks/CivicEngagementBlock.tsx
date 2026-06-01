// "Have Your Say" — turns the dashboard from passive info into civic action.
// Four real HRM channels, ordered low-friction → high-engagement.

type Channel = {
  emoji: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  ring: string;   // colored ring around the emoji badge
  badge: string;  // emoji badge background
};

const CHANNELS: Channel[] = [
  {
    emoji: '🛠️',
    title: 'Report a problem · 311',
    desc: 'Potholes, missed garbage, broken streetlights, noise, bylaw issues — report it by phone or online.',
    cta: 'Call 311 or report online',
    href: 'https://www.halifax.ca/home/311',
    ring: 'ring-amber-500/30',
    badge: 'bg-amber-500/15',
  },
  {
    emoji: '💬',
    title: 'Shape Your City',
    desc: "Surveys and comments on active plans, budgets, and policy — the city's official public engagement hub.",
    cta: 'Browse consultations',
    href: 'https://www.shapeyourcityhalifax.ca/',
    ring: 'ring-blue-500/30',
    badge: 'bg-blue-500/15',
  },
  {
    emoji: '🏛️',
    title: 'Find your Councillor',
    desc: 'Look up the councillor for your district and reach out to them directly.',
    cta: 'Look up by address',
    href: 'https://www.halifax.ca/city-hall/districts-councillors',
    ring: 'ring-emerald-500/30',
    badge: 'bg-emerald-500/15',
  },
  {
    emoji: '📋',
    title: 'Speak at Regional Council',
    desc: 'Attend a meeting, speak at a public hearing, or submit written comments on decisions.',
    cta: 'Meetings & agendas',
    href: 'https://www.halifax.ca/city-hall/agendas-meetings-reports',
    ring: 'ring-violet-500/30',
    badge: 'bg-violet-500/15',
  },
];

export default function CivicEngagementBlock() {
  return (
    <div className="space-y-3">
      {/* Intro line */}
      <p className="text-sm text-foreground/60 px-1 leading-relaxed">
        See something that needs fixing — or want a say in how Halifax runs?
        Here&apos;s how to make your voice heard.
      </p>

      <div className="space-y-2.5">
        {CHANNELS.map((c) => (
          <a
            key={c.title}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3.5 rounded-2xl border border-border bg-card hover:border-foreground/20 hover:shadow-md px-4 py-3.5 transition-all"
          >
            <span
              className={`shrink-0 grid place-items-center w-11 h-11 rounded-full text-xl ring-1 ${c.badge} ${c.ring} group-hover:scale-105 transition-transform`}
              aria-hidden
            >
              {c.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground leading-tight">{c.title}</h3>
              <p className="text-xs text-foreground/60 mt-1 leading-relaxed">{c.desc}</p>
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:gap-1.5 transition-all">
                {c.cta}
                <span aria-hidden>→</span>
              </span>
            </div>
          </a>
        ))}
      </div>

      <p className="text-[11px] text-foreground/35 px-1 leading-snug">
        Tip: 311 is the fastest route for day-to-day issues; Shape Your City and
        Council are where bigger decisions get made.
      </p>
    </div>
  );
}
