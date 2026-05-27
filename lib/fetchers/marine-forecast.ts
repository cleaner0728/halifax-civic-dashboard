// ECCC marine forecast for Halifax Harbour and Approaches (zone m0000053).
// Provides the official plain-English forecast text — wind, visibility, air
// temperature — plus any active marine warnings (gale, storm, freezing
// spray, etc.). Updated by ECCC roughly twice daily.

const ZONE_ID = 'm0000053'; // Halifax Harbour and Approaches
const URL = `https://api.weather.gc.ca/collections/marineweather-realtime/items/${ZONE_ID}?lang=en&f=json`;
const UA =
  'HalifaxCivicDashboard/1.0 (+https://github.com/cleaner0728/halifax-civic-dashboard)';

export interface MarineWarning {
  name: string;          // "Strong wind warning"
  type: string;          // "warning" | "watch" | "advisory" | "statement"
  status: string;        // "IN EFFECT" etc.
}

export interface MarineForecast {
  issuedAt: string;      // ISO UTC
  periodOfCoverage: string; // "Today Tonight and Thursday"
  wind: string;
  visibility: string;
  airTemperature: string;
  warnings: MarineWarning[];
}

interface BilingualValue {
  en?: string;
}
interface WeatherCondition {
  periodOfCoverage?: BilingualValue;
  weatherVisibility?: BilingualValue;
  airTemperature?: BilingualValue;
  wind?: BilingualValue;
}
interface WarningEvent {
  name?: BilingualValue;
  type?: BilingualValue;
  status?: BilingualValue;
}

function pickEn(v: BilingualValue | undefined): string {
  return (v?.en ?? '').trim();
}

export async function fetchMarineForecast(): Promise<MarineForecast | null> {
  try {
    const res = await fetch(URL, {
      next: { revalidate: 1800 }, // 30 min — ECCC updates ~twice daily
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const feat = await res.json();
    const p = feat?.properties;
    if (!p) return null;

    const loc = p.regularForecast?.locations?.[0];
    const cond: WeatherCondition = loc?.weatherCondition ?? {};

    const warningLoc = p.warnings?.locations?.[0];
    const events: WarningEvent[] = warningLoc?.events ?? [];
    const warnings: MarineWarning[] = events.map((e) => ({
      name: pickEn(e.name),
      type: pickEn(e.type).toLowerCase(),
      status: pickEn(e.status),
    })).filter((w) => w.name);

    return {
      issuedAt: p.regularForecast?.issuedDatetimeUTC ?? '',
      periodOfCoverage: pickEn(cond.periodOfCoverage),
      wind: pickEn(cond.wind),
      visibility: pickEn(cond.weatherVisibility),
      airTemperature: pickEn(cond.airTemperature),
      warnings,
    };
  } catch (e) {
    console.error('Failed to fetch marine forecast:', e);
    return null;
  }
}
