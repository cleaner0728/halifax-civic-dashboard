// Halifax Harbour tide data from DFO (Fisheries & Oceans Canada).
// Station ID is hard-coded for Halifax (5cebf1df3d0f4a073c4bbcbb).

export type TidePoint = { time: string; value: number };

export type TideGraphData = {
  fillPoints: string;
  linePoints: string;
  nowX: number;
  currentLevel: number;
  nextHigh: TidePoint | null;
  nextLow: TidePoint | null;
  nextHighX: number;
  nextHighY: number;
  nextLowX: number;
  nextLowY: number;
};

export async function fetchTides(): Promise<TidePoint[]> {
  try {
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z';
    const to = new Date(now.getTime() + 21 * 60 * 60 * 1000).toISOString().slice(0, 19) + 'Z';
    const url = `https://api-iwls.dfo-mpo.gc.ca/api/v1/stations/5cebf1df3d0f4a073c4bbcbb/data?time-series-code=wlp&from=${from}&to=${to}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ eventDate: string; value: number }>;
    // API returns 1-minute resolution; downsample to 15-minute steps for a lighter SVG.
    return data.filter((_, i) => i % 15 === 0).map((d) => ({ time: d.eventDate, value: d.value }));
  } catch {
    return [];
  }
}

export function computeTideGraph(tides: TidePoint[]): TideGraphData | null {
  if (tides.length < 2) return null;
  const W = 800,
    H = 72,
    PAD = 4;
  const values = tides.map((t) => t.value);
  const times = tides.map((t) => new Date(t.time).getTime());
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeRange = maxTime - minTime || 1;
  const now = Date.now();

  const tx = (t: number) => PAD + ((t - minTime) / timeRange) * (W - 2 * PAD);
  const vy = (v: number) => H - PAD - ((v - minVal) / range) * (H - 2 * PAD);

  const pts = tides.map((t, i) => `${tx(times[i]).toFixed(1)},${vy(t.value).toFixed(1)}`).join(' ');

  let closestIdx = 0;
  let closestDiff = Infinity;
  times.forEach((t, i) => {
    const d = Math.abs(t - now);
    if (d < closestDiff) {
      closestDiff = d;
      closestIdx = i;
    }
  });

  let nextHigh: TidePoint | null = null;
  let nextLow: TidePoint | null = null;
  let nextHighX = 0,
    nextHighY = 0,
    nextLowX = 0,
    nextLowY = 0;
  for (let i = 1; i < tides.length - 1; i++) {
    if (times[i] <= now) continue;
    if (!nextHigh && tides[i].value > tides[i - 1].value && tides[i].value >= tides[i + 1].value) {
      nextHigh = tides[i];
      nextHighX = tx(times[i]);
      nextHighY = vy(tides[i].value);
    }
    if (!nextLow && tides[i].value < tides[i - 1].value && tides[i].value <= tides[i + 1].value) {
      nextLow = tides[i];
      nextLowX = tx(times[i]);
      nextLowY = vy(tides[i].value);
    }
    if (nextHigh && nextLow) break;
  }

  return {
    fillPoints: `${PAD},${H} ${pts} ${W - PAD},${H}`,
    linePoints: pts,
    nowX: Math.max(PAD, Math.min(W - PAD, tx(now))),
    currentLevel: tides[closestIdx]?.value ?? 0,
    nextHigh,
    nextLow,
    nextHighX,
    nextHighY,
    nextLowX,
    nextLowY,
  };
}
