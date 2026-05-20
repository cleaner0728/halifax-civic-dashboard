// Halifax air quality from Open-Meteo. Free, no key. Returns the US AQI
// (0-500 scale) — Canada's official AQHI (1-10) would be more locally
// idiomatic but requires parsing the Environment Canada XML feed; the
// underlying particulate measurements come from the same upstream sources.

export type AirQuality = {
  aqi: number;       // US AQI, 0-500
  pm25: number;      // µg/m³
};

export async function fetchAirQuality(): Promise<AirQuality | null> {
  try {
    const res = await fetch(
      'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=44.65&longitude=-63.57' +
        '&current=us_aqi,pm2_5',
      { next: { revalidate: 900 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const aqi = data?.current?.us_aqi;
    if (typeof aqi !== 'number') return null;
    return {
      aqi: Math.round(aqi),
      pm25: Number((data.current.pm2_5 ?? 0).toFixed(1)),
    };
  } catch (e) {
    console.error('Failed to fetch air quality:', e);
    return null;
  }
}
