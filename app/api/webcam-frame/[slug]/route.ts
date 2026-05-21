import { NextResponse } from "next/server";

// Why this route exists: novascotiawebcams.com publishes a stable
// /<slug>/og_image.jpg endpoint for each cam, but for the bridge + museum
// cams that endpoint has been stuck for 30+ minutes at a time. The fresh
// frames live under /previews/<slug>/YYYY/MM/DD/HH/<uuid>...jpg — same
// upstream CDN, just rotating UUID paths we can't construct ourselves.
//
// Strategy: scrape one cam page (its preview gallery embeds the latest
// preview_url for every cam on the site), parse out the URL map, cache it
// in module memory for 30s, then proxy the upstream image bytes through to
// the client. Earlier iterations tried a 302 redirect, but browsers cache
// the final upstream URL by path — so within our 30s cache window, every
// `?t=…` request resolves to the same UUID URL and the browser serves the
// cached bytes, making the cam look frozen. Proxying sidesteps that by
// keeping a unique URL (the cache-buster) end-to-end.
//
// NOTE: `cache` and `inflight` below are module-scoped, so they only work
// inside a long-lived Node process (e.g. `next dev`, a Docker container).
// On serverless platforms (Vercel functions) each invocation gets fresh
// memory and we end up scraping per-request. If/when this goes to such a
// platform, swap for a shared store (Vercel KV, Upstash Redis, etc.).

// Pick a low-traffic cam page to minimize our footprint on upstream.
const SCRAPE_URL = "https://www.novascotiawebcams.com/webcams/maritime-museum";
const TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 5_000;
// Whitelist of upstream slugs we'll proxy. Stops `/api/webcam-frame/<anything>`
// from being a generic CDN proxy and bounds what URLs we'll attempt to fetch.
const ALLOWED_SLUGS = new Set([
  "maritimemuseum",
  // Add other upstream slugs here if we point more image cams at this route.
]);
const FALLBACK_URL = (slug: string) =>
  `https://images.novascotiawebcams.com/${slug}/og_image.jpg`;

type Cache = { fetchedAt: number; urls: Map<string, string> };
let cache: Cache | null = null;
let inflight: Promise<Map<string, string>> | null = null;

// Match preview URLs directly rather than anchoring on `"preview_url":` —
// the JSON is embedded inside a JS string in the HTML, so quotes show up
// escaped as \" which breaks naive key-anchored regex. The URL itself is
// stable. Group 1 = upstream slug. We rely on page order: the first
// occurrence per slug is the freshest snapshot.
const PREVIEW_RE =
  /https:\/\/images\.novascotiawebcams\.com\/previews\/([a-zA-Z0-9_-]+)\/\d{4}\/\d{2}\/\d{2}\/\d{2}\/[a-f0-9-]+-\d{8}-\d{6}-[A-Z]+-[a-f0-9-]+\.jpg/g;

async function scrapePreviews(): Promise<Map<string, string>> {
  const res = await fetch(SCRAPE_URL, {
    headers: { "User-Agent": "halifax-civic-dashboard/webcam-frame" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const html = await res.text();
  const map = new Map<string, string>();
  for (const m of html.matchAll(PREVIEW_RE)) {
    // Keep only the FIRST match per slug — the gallery JSON repeats some
    // cams with older snapshots further down the page.
    if (!map.has(m[1])) map.set(m[1], m[0]);
  }
  return map;
}

async function getPreviewMap(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.urls;
  // Coalesce concurrent refreshes — many tabs opening simultaneously
  // shouldn't trigger N parallel scrapes.
  if (inflight) return inflight;
  inflight = scrapePreviews()
    .then((urls) => {
      cache = { fetchedAt: Date.now(), urls };
      return urls;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function proxyImage(url: string): Promise<NextResponse> {
  const upstream = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      // Tell intermediaries (and Next dev's data cache) not to hold onto
      // this — the client already cache-busts with `?t=`.
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!ALLOWED_SLUGS.has(slug)) {
    return new NextResponse("unknown slug", { status: 404 });
  }
  try {
    const map = await getPreviewMap();
    const url = map.get(slug) ?? FALLBACK_URL(slug);
    return await proxyImage(url);
  } catch {
    // If the scrape or upstream fetch fails (timeout, network, etc.), fall
    // back to og_image so we still show *something* instead of breaking
    // the UI. If even that fails, surface a 502 to the client.
    try {
      return await proxyImage(FALLBACK_URL(slug));
    } catch {
      return new NextResponse("upstream unavailable", { status: 502 });
    }
  }
}
