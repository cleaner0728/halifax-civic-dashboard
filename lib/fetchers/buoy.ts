// SmartAtlantic Halifax (Herring Cove) buoy — real-time marine
// observations exposed via the CIOOS Atlantic ERDDAP server. JSON,
// no API key. Updates roughly every 30 min when the buoy is online;
// the buoy occasionally goes offline for hours-to-days at a time, so
// callers MUST surface the observed timestamp and tolerate stale data.

const ERDDAP_URL =
  'https://www.smartatlantic.ca/erddap/tabledap/SMA_halifax.json' +
  '?time,wind_spd_avg,wind_spd_max,wind_dir_avg' +
  ',wave_ht_sig,wave_ht_max,wave_period_max,wave_dir_avg,wave_spread_avg' +
  ',surface_temp_avg,air_pressure_avg,curr_spd_avg,curr_dir_avg' +
  '&time>=now-24hours&orderByMax("time")';

const UA =
  'HalifaxCivicDashboard/1.0 (+https://github.com/cleaner0728/halifax-civic-dashboard)';

export interface BuoyObservation {
  observedAt: string;     // ISO UTC
  windSpeed: number | null;     // km/h (converted from m/s)
  windGust: number | null;      // km/h
  windDirection: number | null; // degrees
  waveHeightSig: number | null; // m, significant
  waveHeightMax: number | null; // m
  wavePeriodMax: number | null; // s
  waveDirection: number | null; // degrees
  waveSpread: number | null;    // degrees
  waterTemp: number | null;     // °C
  pressure: number | null;      // mbar
  currentSpeed: number | null;  // m/s (converted from mm/s) — surface (~0.5 m)
  currentDirection: number | null; // degrees
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function fetchBuoy(): Promise<BuoyObservation | null> {
  try {
    const res = await fetch(ERDDAP_URL, {
      next: { revalidate: 900 },
      headers: { 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const row = json?.table?.rows?.[0];
    if (!Array.isArray(row)) return null;

    // Column order matches the request above.
    const [
      time,
      windAvg, windMax, windDir,
      waveSig, waveMax, wavePer, waveDir, waveSpread,
      waterTemp, pressure, currSpd, currDir,
    ] = row;

    const mps = num(windAvg);
    const gst = num(windMax);
    const curr = num(currSpd);

    return {
      observedAt: String(time),
      windSpeed: mps !== null ? +(mps * 3.6).toFixed(1) : null,
      windGust: gst !== null ? +(gst * 3.6).toFixed(1) : null,
      windDirection: num(windDir),
      waveHeightSig: num(waveSig),
      waveHeightMax: num(waveMax),
      wavePeriodMax: num(wavePer),
      waveDirection: num(waveDir),
      waveSpread: num(waveSpread),
      waterTemp: num(waterTemp),
      pressure: num(pressure),
      currentSpeed: curr !== null ? +(curr / 1000).toFixed(2) : null,
      currentDirection: num(currDir),
    };
  } catch (e) {
    console.error('Failed to fetch buoy:', e);
    return null;
  }
}
