// Environment Canada (ECCC) weather alerts for "Halifax Metro and Halifax
// County West" (battleboard region ns1).
//
// Two data sources, layered:
//
//   1. Atom feed at /rss/battleboard/ns1_e.xml — the authoritative list of
//      currently-active alerts. ECCC publishes this as a contract-style
//      public API; if an alert is there, it's active; if it's not, we
//      don't show it. This is the gatekeeper.
//
//   2. The /warnings/report HTML page's embedded `__INITIAL_STATE__` JSON
//      blob — same data plus the full descriptive body, expiry time, and
//      affected zones. We use this opportunistically to enrich the cards;
//      if the HTML structure changes one day, the regex misses, and we
//      simply fall back to feed-only display (title + impact + confidence
//      still render). Banner never silently breaks.
//
// Expired alerts are filtered out belt-and-suspenders: ECCC normally drops
// them from the feed on expiry, but we also check expiresAt < now when
// the HTML enrichment provides it.

import Parser from "rss-parser";

export type AlertSeverity = "warning" | "watch" | "advisory" | "statement" | "unknown";
export type AlertColor = "red" | "amber" | "blue";

export interface WeatherAlert {
  title: string;
  severity: AlertSeverity;
  color: AlertColor;
  impact: string;
  confidence: string;
  issuedAt: string;
  issuedText: string;     // "" when only Atom is available (no human-friendly form)
  expiresAt: string;      // "" when only Atom is available
  affectedArea: string;
  description: string;    // "" when HTML enrichment unavailable — banner hides paragraph
  link: string;
}

const FEED_URL = "https://weather.gc.ca/rss/battleboard/ns1_e.xml";
const REPORT_URL = "https://weather.gc.ca/warnings/report_e.html?ns1=";

const UA = "HalifaxCivicDashboard/1.0 (+https://github.com/cleaner0728/halifax-civic-dashboard)";

// One ECCC alert object as it appears inside `__INITIAL_STATE__`.
interface EcccAlert {
  type?: string;
  status?: string;
  issueTime?: string;
  issueTimeText?: string;
  expiryTime?: string;
  bannerText?: string;
  colour?: string;
  impact?: string;
  confidence?: string;
  text?: string;
  refLocs?: Record<string, { name?: string }>;
}

// Atom entry with the non-standard <impact> and <confidence> child elements
// ECCC slips inside each <entry>. rss-parser keeps unknown elements as-is
// when we list them in `customFields`.
interface AtomItem {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  impact?: string;
  confidence?: string;
}

// Map ECCC's banner shape "Yellow Advisory - Frost, Halifax Metro and
// Halifax County West" → ("YELLOW", "ADVISORY", "FROST"). The fourth
// capture (region) we discard since it's always the same for us.
const TITLE_RE = /^(RED|YELLOW)\s+(WARNING|WATCH|ADVISORY|STATEMENT)\s*-\s*(.+?)(?:,\s*Halifax.*)?$/i;

function classifySeverity(typeOrWord: string | undefined): AlertSeverity {
  switch ((typeOrWord ?? "").toLowerCase()) {
    case "warning": return "warning";
    case "watch": return "watch";
    case "advisory": return "advisory";
    case "statement": return "statement";
    default: return "unknown";
  }
}

function classifyColor(colour: string | undefined): AlertColor {
  switch ((colour ?? "").toLowerCase()) {
    case "red": return "red";
    case "orange":
    case "yellow": return "amber";
    default: return "blue";
  }
}

function shortTitle(banner: string | undefined): string {
  if (!banner) return "ALERT";
  const m = banner.match(/-\s*(.+?)(?:,\s*Halifax.*)?$/i);
  return (m?.[1] ?? banner).trim().toUpperCase();
}

// Normalize a banner string so an Atom entry and an HTML alert that
// describe the same event hash to the same key. Pure characters only;
// regional suffixes and trailing commas drop out.
function alertKey(banner: string | undefined): string {
  return (banner ?? "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 3) // colour + type + name, e.g. "YELLOW ADVISORY FROST"
    .join(" ");
}

async function fetchAtomEntries(): Promise<AtomItem[]> {
  const res = await fetch(FEED_URL, {
    next: { revalidate: 300 },
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const parser = new Parser<unknown, AtomItem>({
    customFields: { item: ["impact", "confidence"] },
  });
  const feed = await parser.parseString(xml);
  return (feed.items ?? []).filter(
    (i) => i.title && !/no alerts? in effect/i.test(i.title),
  );
}

async function fetchHtmlAlerts(): Promise<EcccAlert[]> {
  const res = await fetch(REPORT_URL, {
    next: { revalidate: 300 },
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return [];
  const html = await res.text();
  // Match the embedded SSR state. The IIFE cleanup `;(function(){var s;` is
  // distinctive enough that the non-greedy capture won't run away into
  // adjacent script tags.
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\(function\(\)\{var s;/);
  if (!m) return [];
  type State = { alert?: { alert?: Record<string, { alerts?: EcccAlert[] }> } };
  const state = JSON.parse(m[1]) as State;
  return state.alert?.alert?.ns1?.alerts ?? [];
}

export async function fetchAlerts(): Promise<WeatherAlert[]> {
  try {
    const atomEntries = await fetchAtomEntries();
    if (atomEntries.length === 0) return [];

    // HTML enrichment is best-effort. If parsing fails for any reason
    // (URL change, regex miss, JSON shape drift) we keep going with an
    // empty enrichment map and let the banner render from Atom alone.
    const htmlAlerts = await fetchHtmlAlerts().catch(() => [] as EcccAlert[]);
    const htmlByKey = new Map<string, EcccAlert>();
    for (const h of htmlAlerts) {
      if ((h.status ?? "").toLowerCase() !== "active") continue;
      htmlByKey.set(alertKey(h.bannerText), h);
    }

    const now = Date.now();
    const out: WeatherAlert[] = [];
    for (const a of atomEntries) {
      const titleMatch = (a.title ?? "").match(TITLE_RE);
      const colourWord = titleMatch?.[1];
      const typeWord = titleMatch?.[2];
      const html = htmlByKey.get(alertKey(a.title));

      // Defensive expiry check: trust HTML's expiryTime when we have it.
      // Atom alone has no expiry field; presence in the feed is taken as
      // proof of life.
      if (html?.expiryTime) {
        const expMs = new Date(html.expiryTime).getTime();
        if (Number.isFinite(expMs) && expMs < now) continue;
      }

      out.push({
        title: shortTitle(a.title),
        severity: classifySeverity(html?.type ?? typeWord),
        color: classifyColor(html?.colour ?? colourWord),
        impact: html?.impact ?? a.impact ?? "—",
        confidence: html?.confidence ?? a.confidence ?? "—",
        issuedAt: html?.issueTime ?? a.isoDate ?? a.pubDate ?? "",
        issuedText: html?.issueTimeText ?? "",
        expiresAt: html?.expiryTime ?? "",
        affectedArea:
          Object.values(html?.refLocs ?? {})
            .map((r) => r?.name)
            .filter((n): n is string => !!n)
            .join(", ") || "Halifax Metro and Halifax County West",
        description: (html?.text ?? "").trim(),
        link: a.link ?? REPORT_URL,
      });
    }
    return out;
  } catch (e) {
    console.error("Failed to fetch ECCC alerts:", e);
    return [];
  }
}
