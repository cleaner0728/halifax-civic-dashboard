// Environment Canada (ECCC) weather alerts for "Halifax Metro and Halifax
// County West" (battleboard region ns1).
//
// We pull from the alert report HTML page rather than the public Atom feed
// because the feed only carries the title + issued time + impact +
// confidence. The full descriptive text (what the alert IS, the
// temperatures, the affected zones, the public-safety guidance) only lives
// on the HTML page — and conveniently, that page server-side renders the
// state as a single `window.__INITIAL_STATE__ = {…};` JSON blob in a
// <script> tag. Extracting it gives us a clean structured payload without
// having to walk the rendered DOM (no risk of class-name drift breaking us).
//
// When no alerts are active the JSON has `alerts: []` and we return [].

export type AlertSeverity = "warning" | "watch" | "advisory" | "statement" | "unknown";
export type AlertColor = "red" | "amber" | "blue";

export interface WeatherAlert {
  // Short display name: "FROST", "SEVERE THUNDERSTORM", etc.
  title: string;
  severity: AlertSeverity;
  color: AlertColor;
  impact: string;       // "Moderate" / "Low" / "High"
  confidence: string;   // "High" / "Medium" / "Low"
  issuedAt: string;     // ISO 8601
  issuedText: string;   // Human-friendly e.g. "9:52 p.m. ADT Thursday 21 May 2026"
  expiresAt: string;    // ISO 8601
  affectedArea: string; // "Halifax Metro and Halifax County West"
  description: string;  // Full multi-paragraph alert body, "\n\n"-separated
  link: string;
}

const REPORT_URL = "https://weather.gc.ca/warnings/report_e.html?ns1=";

// One ECCC alert object as it appears inside `__INITIAL_STATE__`.
// Fields we don't read are intentionally omitted to avoid coupling to
// ECCC's wider schema.
interface EcccAlert {
  type?: string;            // "advisory" | "warning" | "watch" | "statement"
  status?: string;          // "active" | other
  issueTime?: string;
  issueTimeText?: string;
  expiryTime?: string;
  bannerText?: string;      // e.g. "Yellow Advisory - Frost"
  colour?: string;          // "yellow" | "red" | "orange" | …
  impact?: string;
  confidence?: string;
  text?: string;
  refLocs?: Record<string, { name?: string }>;
}

function classifySeverity(type: string | undefined): AlertSeverity {
  switch ((type ?? "").toLowerCase()) {
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

// Pull just the meaningful "name" piece out of a banner like
// "Yellow Advisory - Frost". Falls back to the raw banner if the dash-
// separated shape isn't there.
function shortTitle(banner: string | undefined): string {
  if (!banner) return "ALERT";
  const m = banner.match(/-\s*(.+)$/);
  return (m?.[1] ?? banner).trim().toUpperCase();
}

export async function fetchAlerts(): Promise<WeatherAlert[]> {
  try {
    // 5-minute revalidation: short enough that a new warning lands within
    // a coffee-break, long enough not to hammer ECCC from every render.
    const res = await fetch(REPORT_URL, {
      next: { revalidate: 300 },
      headers: {
        "User-Agent": "HalifaxCivicDashboard/1.0 (+https://github.com/cleaner0728/halifax-civic-dashboard)",
      },
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Match the embedded SSR state. The terminator `;(function(){var s;` is
    // very specific to this script's IIFE cleanup, so the non-greedy
    // capture won't run away into other script tags.
    const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\(function\(\)\{var s;/);
    if (!m) return [];

    type State = {
      alert?: { alert?: Record<string, { alerts?: EcccAlert[] }> };
    };
    const state = JSON.parse(m[1]) as State;
    const ecccAlerts = state.alert?.alert?.ns1?.alerts ?? [];

    return ecccAlerts
      .filter((a) => (a.status ?? "").toLowerCase() === "active")
      .map((a): WeatherAlert => {
        const affected = Object.values(a.refLocs ?? {})
          .map((r) => r?.name)
          .filter((n): n is string => !!n)
          .join(", ");
        return {
          title: shortTitle(a.bannerText),
          severity: classifySeverity(a.type),
          color: classifyColor(a.colour),
          impact: a.impact ?? "—",
          confidence: a.confidence ?? "—",
          issuedAt: a.issueTime ?? "",
          issuedText: a.issueTimeText ?? "",
          expiresAt: a.expiryTime ?? "",
          affectedArea: affected || "Halifax Metro and Halifax County West",
          description: (a.text ?? "").trim(),
          link: REPORT_URL,
        };
      });
  } catch (e) {
    console.error("Failed to fetch ECCC alerts:", e);
    return [];
  }
}
