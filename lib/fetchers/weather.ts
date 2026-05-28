// Environment Canada (ECCC) city page weather for Halifax (ns-19).
// Uses the api.weather.gc.ca OGC API endpoint — same data source as the
// weather alerts fetcher (weather.gc.ca). Free, no key required.

const ECCC_URL =
  'https://api.weather.gc.ca/collections/citypageweather-realtime/items/ns-19?lang=en&f=json';
const UA =
  'HalifaxCivicDashboard/1.0 (+https://github.com/cleaner0728/halifax-civic-dashboard)';

export interface WeatherData {
  temperature: number;
  apparentTemp: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  dewpoint: number;
  visibility: number;   // km
  pressure: number;
  pressureTendency: 'rising' | 'falling' | 'steady' | null;
  pressureChange: number; // hPa over past 3 h (sign matches tendency)
  isDay: boolean;
  uvIndex: number;
  hourly: {
    timestamp: string;  // ISO UTC
    temp: number;
    weatherCode: number;
    pop: number;        // likelihood of precipitation %
  }[];
  daily: {
    date: string;
    weatherCode: number;
    maxTemp: number;
    minTemp: number;
    textSummary: string;
    sunrise: string;
    sunset: string;
  }[];
}

// Map ECCC icon codes (1–48) to WMO-compatible codes that weather-theme.ts
// already handles. Day (1–32) and night (33–48) icons are both included.
const ECCC_TO_WMO: Record<number, number> = {
  1: 0,   // Sunny
  2: 1,   // Mainly sunny
  3: 2,   // Partly cloudy
  4: 2,   // Mix of sun and cloud
  5: 3,   // Mostly cloudy
  6: 3,   // Cloudy
  7: 80,  // Light rain shower
  8: 80,  // Rain shower
  9: 80,  // Chance of shower
  10: 51, // Light drizzle
  11: 51, // Chance of drizzle
  12: 53, // Drizzle
  13: 51, // Freezing drizzle
  14: 51, // Chance of freezing drizzle
  15: 63, // Rain
  16: 61, // Light rain
  17: 65, // Heavy rain
  18: 61, // Chance of rain
  19: 61, // Chance of light rain
  20: 77, // Ice pellets
  21: 77, // Chance of ice pellets
  22: 65, // Freezing rain
  23: 65, // Chance of freezing rain
  24: 73, // Snow
  25: 71, // Chance of snow
  26: 71, // Light snow
  27: 75, // Heavy snow
  28: 75, // Blowing snow
  29: 75, // Drifting snow
  30: 95, // Thunderstorm with rain
  31: 99, // Thunderstorm with hail
  32: 0,  // Sunny (alt)
  33: 0,  // Clear night
  34: 1,  // Mainly clear night
  35: 2,  // Partly cloudy night
  36: 3,  // Mostly cloudy night
  37: 3,  // Cloudy night
  38: 80, // Light rain shower night
  39: 80, // Rain shower night
  40: 80, // Chance of shower night
  41: 51, // Chance of drizzle night
  42: 53, // Drizzle night
  43: 61, // Chance of rain night
  44: 63, // Rain night
  45: 65, // Heavy rain night
  46: 80, // Heavy shower night
  47: 73, // Snow night
  48: 71, // Light snow night
};

function ecccIconToWmo(code: number | null | undefined): number {
  if (!code) return 3;
  return ECCC_TO_WMO[code] ?? 3;
}

// ECCC's numeric iconCode is unreliable (e.g. code 28 returns "Light Drizzle"
// but the published table says "Blowing snow"). The human-readable `condition`
// string is consistently accurate, so we parse it directly and only fall back
// to the iconCode when no condition text is provided.
function conditionTextToWmo(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (/thunderstorm|thunder/.test(t)) return /hail/.test(t) ? 99 : 95;
  if (/blizzard|blowing snow/.test(t)) return 75;
  if (/snow|flurr/.test(t)) {
    if (/heavy/.test(t)) return 75;
    if (/light/.test(t)) return 71;
    if (/shower/.test(t)) return 85;
    return 73;
  }
  if (/ice pellet|sleet|hail/.test(t)) return 77;
  if (/freezing drizzle/.test(t)) return 56;
  if (/freezing rain/.test(t)) return 66;
  if (/drizzle/.test(t)) {
    if (/heavy/.test(t)) return 55;
    if (/light/.test(t)) return 51;
    return 53;
  }
  if (/shower/.test(t)) return /heavy/.test(t) ? 81 : 80;
  if (/rain/.test(t)) {
    if (/heavy/.test(t)) return 65;
    if (/light/.test(t)) return 61;
    return 63;
  }
  if (/fog|mist|haze|smoke/.test(t)) return 45;
  if (/overcast|cloud/.test(t)) {
    if (/partly|mix/.test(t)) return 2;
    return 3;
  }
  if (/sunny|clear|fair/.test(t)) return /mainly|mostly/.test(t) ? 1 : 0;
  return null;
}

export async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const res = await fetch(ECCC_URL, {
      next: { revalidate: 900 },
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;

    const feat = await res.json();
    const p = feat.properties;
    const cc = p.currentConditions;
    const riseSet = p.riseSet;
    const forecasts: {
      period: { textForecastName: { en: string } };
      temperatures: { temperature: { class: { en: string }; value: { en: number } }[] };
      abbreviatedForecast: { icon?: { value: number }; textSummary?: { en: string } };
      uv?: { index?: { en: string } };
    }[] = p.forecastGroup?.forecasts ?? [];

    // is_day: current time between sunrise and sunset (both UTC ISO strings)
    const now = Date.now();
    const sunriseMs = riseSet?.sunrise?.en ? new Date(riseSet.sunrise.en).getTime() : 0;
    const sunsetMs = riseSet?.sunset?.en ? new Date(riseSet.sunset.en).getTime() : 0;
    const isDay = sunriseMs > 0 && sunsetMs > 0 ? now >= sunriseMs && now < sunsetMs : true;

    const temperature: number = cc.temperature?.value?.en ?? 0;

    // Feels-like: humidex on hot days (≥ 25 °C), windChill on cold days (≤ 10 °C).
    const windChill: number | undefined = cc.windChill?.value?.en;
    const humidex: number | undefined = cc.humidex?.value?.en;
    const apparentTemp =
      typeof humidex === 'number' && temperature >= 25 && humidex > temperature
        ? humidex
        : typeof windChill === 'number' && temperature <= 0 && windChill < temperature
        ? windChill
        : temperature;

    // Pressure: ECCC provides kPa; WeatherBlock expects hPa (× 10).
    const pressure: number = (cc.pressure?.value?.en ?? 0) * 10;
    const rawTendency = (cc.pressure?.tendency?.en ?? '').toLowerCase();
    const pressureTendency: WeatherData['pressureTendency'] =
      rawTendency === 'rising' || rawTendency === 'falling' || rawTendency === 'steady'
        ? rawTendency
        : null;
    // ECCC `change` is unsigned kPa; sign it from tendency and convert to hPa.
    const rawChange = Math.abs(cc.pressure?.change?.en ?? 0) * 10;
    const pressureChange =
      pressureTendency === 'falling' ? -rawChange : pressureTendency === 'rising' ? rawChange : 0;

    const dewpoint: number = cc.dewpoint?.value?.en ?? 0;
    const visibility: number = cc.visibility?.value?.en ?? 0;

    // UV index from today's "Today" or "Tonight" forecast (index 0).
    const uvIndex = parseFloat(forecasts[0]?.uv?.index?.en ?? '0') || 0;

    // Hourly forecast — next 24 h, keep all 24 slots.
    const rawHourly: {
      timestamp: string;
      temperature: { value: { en: number } };
      iconCode: { value: number };
      lop: { value: { en: number } };
    }[] = p.hourlyForecastGroup?.hourlyForecasts ?? [];
    const hourly: WeatherData['hourly'] = rawHourly.map((h) => ({
      timestamp: h.timestamp,
      temp: h.temperature?.value?.en ?? 0,
      weatherCode: ecccIconToWmo(h.iconCode?.value),
      pop: h.lop?.value?.en ?? 0,
    }));

    // Prefer ECCC's `condition` string over the unreliable numeric iconCode.
    // If the text gives nothing, fall back to the iconCode mapping. Finally,
    // if anything still claims snow above ~3 °C (physically implausible),
    // defer to the first hourly forecast icon.
    const conditionText: string | undefined =
      typeof cc.condition === 'string' ? cc.condition : cc.condition?.en;
    const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
    const rawCurrentCode =
      conditionTextToWmo(conditionText) ?? ecccIconToWmo(cc.iconCode?.value);
    const currentWeatherCode =
      SNOW_CODES.has(rawCurrentCode) && temperature > 3
        ? (hourly[0]?.weatherCode ?? 3)
        : rawCurrentCode;

    // Build 5-day daily forecast. ECCC delivers alternating day/night periods:
    // [0] Today (high), [1] Tonight (low), [2] Wednesday (high), [3] Wed night (low), ...
    // We pair them to get a single daily row per calendar day.
    const daily: WeatherData['daily'] = [];
    const today = new Date();

    // Find the first day-period index (may be 0="Today" or could start at a
    // different period if the request is made late at night and ECCC has
    // already dropped "Today").
    let firstDayIdx = 0;
    const firstName = (forecasts[0]?.period?.textForecastName?.en ?? '').toLowerCase();
    // If the first period is a night period, shift pairing by one slot.
    const firstIsNight = /night$|tonight/.test(firstName);
    if (firstIsNight) firstDayIdx = -1; // day period is "missing"; use night's low as min only

    for (let i = 0; i < 7; i++) {
      let dayFcIdx: number;
      let nightFcIdx: number;
      if (firstIsNight) {
        // First slot is a night-only period → day[0] has no high
        dayFcIdx = i === 0 ? -1 : i * 2 - 1;
        nightFcIdx = i === 0 ? 0 : i * 2;
      } else {
        dayFcIdx = i * 2;
        nightFcIdx = i * 2 + 1;
      }

      const dayFc = dayFcIdx >= 0 ? forecasts[dayFcIdx] : undefined;
      const nightFc = forecasts[nightFcIdx];

      if (!dayFc && !nightFc) break;

      const dayTemps = dayFc?.temperatures?.temperature ?? [];
      const nightTemps = nightFc?.temperatures?.temperature ?? [];

      const rawMaxTemp =
        dayTemps.find((t) => t.class?.en === 'high')?.value?.en ??
        dayTemps[0]?.value?.en;
      const rawMinTemp =
        nightTemps.find((t) => t.class?.en === 'low')?.value?.en ??
        nightTemps[0]?.value?.en;
      // If today's day-period is gone (evening fetch), fall back to the
      // warmest remaining hourly temp for that calendar day so the card
      // doesn't render a misleading "0° / 7°" pair.
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() + i);
      const dayDateStr = dayDate.toISOString().split('T')[0];
      const hourlyForDay = hourly
        .filter((h) => h.timestamp.startsWith(dayDateStr))
        .map((h) => h.temp);
      const hourlyMax = hourlyForDay.length ? Math.max(...hourlyForDay) : undefined;
      const minTemp = rawMinTemp ?? rawMaxTemp ?? hourlyMax ?? 0;
      const maxTemp = rawMaxTemp ?? hourlyMax ?? minTemp;

      const iconCode = (dayFc ?? nightFc)?.abbreviatedForecast?.icon?.value;
      const textSummary = (dayFc ?? nightFc)?.abbreviatedForecast?.textSummary?.en ?? '';

      daily.push({
        date: dayDateStr,
        weatherCode: ecccIconToWmo(iconCode),
        maxTemp,
        minTemp,
        textSummary,
        sunrise: i === 0 ? (riseSet?.sunrise?.en ?? '') : '',
        sunset: i === 0 ? (riseSet?.sunset?.en ?? '') : '',
      });
    }

    return {
      temperature,
      apparentTemp,
      weatherCode: currentWeatherCode,
      windSpeed: cc.wind?.speed?.value?.en ?? 0,
      windDirection: cc.wind?.bearing?.value?.en ?? 0,
      humidity: cc.relativeHumidity?.value?.en ?? 0,
      dewpoint,
      visibility,
      pressure,
      pressureTendency,
      pressureChange,
      isDay,
      uvIndex,
      hourly,
      daily,
    };
  } catch (e) {
    console.error('Failed to fetch weather:', e);
    return null;
  }
}
