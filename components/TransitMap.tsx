'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, { Map as MlMap, GeoJSONSource, MapGeoJSONFeature } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type Stop = { id: string; code?: string; name: string; lat: number; lon: number };
type Route = { id: string; short: string; long: string; color?: string; text?: string };
type Vehicle = {
  id: string; routeId?: string; tripId?: string;
  lat: number; lon: number; bearing?: number; speed?: number; ts?: number;
};
type Arrival = {
  routeId?: string; tripId?: string; stopId: string;
  time: number; delay?: number; headsign?: string;
};
type LocStatus = 'prompt' | 'requesting' | 'granted' | 'denied' | 'unavailable';

const RADIUS_METERS = 800;
// Light-green palette for route number pills + vehicle markers — overrides
// the agency-supplied color so every bus reads with the same fresh look.
const ROUTE_PILL_BG = '#86efac';   // emerald-300
const ROUTE_PILL_TEXT = '#064e3b'; // emerald-900
const VEHICLE_POLL_MS = 15_000;
const ARRIVAL_POLL_MS = 20_000;
// Cap the batch arrival request to the N closest stops. 30 keeps the URL
// short and the upstream parse work bounded — arrivals beyond the first
// page of the panel are rarely scrolled to anyway.
const NEARBY_BATCH_LIMIT = 30;
// Debounce window for the viewport state. Without this every micro-pan
// fires a setState → memo recompute → arrivals refetch, hammering the API
// while the user is still dragging. 300ms lets a continuous gesture
// settle before we re-derive anything.
const VIEWPORT_DEBOUNCE_MS = 300;

// Halifax downtown — fallback when the user declines geolocation but still
// wants to see the map.
const FALLBACK_ORIGIN = { lat: 44.6488, lon: -63.5752 };

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

// Equirectangular distance — fine at city scale (sub-meter error for a 1km
// radius). Haversine adds complexity we don't need for a stop filter.
function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dLon = ((b.lon - a.lon) * Math.PI) / 180 * Math.cos(meanLat);
  return R * Math.hypot(dLat, dLon);
}

// 64-point polygon approximating a circle of `radiusMeters` around origin.
// Good enough visually; closes the ring with the first point repeated.
function circlePolygon(origin: { lat: number; lon: number }, radiusMeters: number): GeoJSON.Feature {
  const points: [number, number][] = [];
  const latDeg = radiusMeters / 111_320;
  const lonDeg = radiusMeters / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    points.push([origin.lon + Math.cos(a) * lonDeg, origin.lat + Math.sin(a) * latDeg]);
  }
  points.push(points[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [points] } };
}

function stopsToGeoJSON(stops: Stop[]): GeoJSON.FeatureCollection {
  // Properties stay minimal — only `id` (click identity) and `name` (label
  // layer at zoom ≥ 16). Skipping `code` shaves ~30 KB off the GeoJSON we
  // hand maplibre and reduces GC churn during pan/zoom.
  return {
    type: 'FeatureCollection',
    features: stops.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { id: s.id, name: s.name },
    })),
  };
}

function vehiclesToGeoJSON(vs: Vehicle[], routes: Map<string, Route>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: vs.map((v) => {
      const r = v.routeId ? routes.get(v.routeId) : undefined;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
        properties: {
          id: v.id,
          routeShort: r?.short ?? '',
          routeColor: ROUTE_PILL_BG,
          routeText: ROUTE_PILL_TEXT,
        },
      };
    }),
  };
}

function formatEta(epochSeconds: number): string {
  const mins = Math.round((epochSeconds * 1000 - Date.now()) / 60_000);
  if (mins <= 0) return 'now';
  if (mins === 1) return '1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function TransitMap({ stops, routes }: { stops: Stop[]; routes: Route[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const mapReadyRef = useRef(false);

  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>('prompt');
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[] | null>(null);
  const [arrivalsLoading, setArrivalsLoading] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nearbyArrivals, setNearbyArrivals] = useState<Record<string, Arrival[]>>({});
  // Mobile default: collapsed to a peek bar so the map owns the screen.
  // Desktop always shows the full panel (panelOpen is forced true at sm+).
  const [panelOpen, setPanelOpen] = useState(false);
  // Tailwind sm: breakpoint = 640px. Tracked in JS so we can apply an
  // inline max-height conditionally — using arbitrary-value Tailwind
  // classes in a dynamic string proved unreliable in this v4 setup.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // ----- Drag-to-resize for the mobile bottom sheet -----
  // The panel always sits at translateY(0) when open and translateY(peek)
  // when collapsed; during a drag we mutate the element's transform
  // directly (skipping React) so the motion follows the finger at 60fps,
  // then snap to a target state on release based on position + velocity.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startY: number;
    startTranslate: number;
    samples: Array<{ y: number; t: number }>;
    moved: boolean;
  } | null>(null);
  // Tracks the moment a drag-snap resolved, so the synthetic click that
  // fires right after a touch release on the same button can be ignored
  // (otherwise drag + auto-click would double-toggle panelOpen).
  const suppressClickUntilRef = useRef(0);

  // Peek offset = how far down we have to push the sheet so only the
  // 3.5rem header remains visible. Recomputed on resize so the calc stays
  // accurate after rotation, browser-zoom, or virtual-keyboard show/hide.
  const computePeekOffset = useCallback(() => {
    if (typeof window === 'undefined') return 0;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return window.innerHeight * 0.75 - 3.5 * rem;
  }, []);
  // Tracked in state so React's inline `transform` uses a plain px value
  // matching the px values we set during drag. Mixing calc(...) with px
  // breaks transform's interpolation on Chrome — the animation just snaps
  // — even though both are length values per spec.
  const [peekPx, setPeekPx] = useState(0);
  useEffect(() => {
    const update = () => setPeekPx(computePeekOffset());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [computePeekOffset]);

  const onSheetPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isDesktop) return;
    // Only initiate drag from the header strip — let the list area scroll
    // normally. The header button has data-sheet-handle for this check.
    if (!(e.target as HTMLElement).closest('[data-sheet-handle]')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const startTranslate = panelOpen ? 0 : computePeekOffset();
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startTranslate,
      samples: [{ y: e.clientY, t: performance.now() }],
      moved: false,
    };
    panel.setPointerCapture(e.pointerId);
    panel.style.transition = 'none';
  }, [isDesktop, panelOpen, computePeekOffset]);

  const onSheetPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const panel = panelRef.current;
    if (!d || !d.active || !panel || e.pointerId !== d.pointerId) return;
    const dy = e.clientY - d.startY;
    if (Math.abs(dy) > 4) d.moved = true;
    const peek = computePeekOffset();
    // Small overscroll buffer at both ends keeps the gesture feeling alive
    // without ever revealing the page behind the sheet.
    const next = Math.max(-32, Math.min(peek + 32, d.startTranslate + dy));
    panel.style.transform = `translateY(${next}px)`;
    d.samples.push({ y: e.clientY, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
  }, [computePeekOffset]);

  const onSheetPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const panel = panelRef.current;
    if (!d || !d.active || !panel) return;
    d.active = false;
    try { panel.releasePointerCapture(d.pointerId); } catch {}

    // If the user barely moved, treat this as a tap and let the header
    // button's onClick toggle the panel. We need to RESTORE the transition
    // (we suppressed it on pointerdown) before React's next render fires,
    // and leave `transform` untouched so its current value matches what
    // React last rendered — no flash on the way back.
    if (!d.moved) {
      panel.style.transition = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)';
      dragRef.current = null;
      return;
    }

    // Velocity from the last few samples (px/ms; positive = downward).
    let vy = 0;
    const s = d.samples;
    if (s.length >= 2) {
      const a = s[0], b = s[s.length - 1];
      const dt = b.t - a.t;
      if (dt > 0) vy = (b.y - a.y) / dt;
    }
    const peek = computePeekOffset();
    const currentTranslate = Math.max(0, Math.min(peek, d.startTranslate + (e.clientY - d.startY)));

    // Snap decision: a clear flick wins; otherwise pick the nearer half.
    let openTarget: boolean;
    if (vy > 0.6) openTarget = false;
    else if (vy < -0.6) openTarget = true;
    else openTarget = currentTranslate < peek / 2;

    // Animate from the current finger position to the target ourselves
    // before handing the style back to React. If we cleared the inline
    // transform first, React's next render briefly puts the sheet at its
    // panelOpen=true position before re-rendering with the new state,
    // which flashes upward for a frame.
    // Set the target inline so the in-flight animation continues smoothly
    // from the finger's release point to the snap target. React's next
    // render produces the same `transform` value (derived from panelOpen),
    // so the reconciler is a no-op for this element — no flash and no
    // post-animation cleanup needed.
    panel.style.transition = 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)';
    panel.style.transform = openTarget ? 'translateY(0)' : `translateY(${peek}px)`;
    suppressClickUntilRef.current = performance.now() + 400;
    dragRef.current = null;
    setPanelOpen(openTarget);
  }, [computePeekOffset]);
  const [locError, setLocError] = useState<string | null>(null);
  // Viewport changes as the user pans/zooms. We re-derive the visible stops
  // and the panel from this — so zooming out exposes more stops and the
  // next-bus list grows accordingly.
  const [viewport, setViewport] = useState<{
    west: number; south: number; east: number; north: number;
    centerLon: number; centerLat: number;
  } | null>(null);

  const routesById = useMemo(() => {
    const m = new Map<string, Route>();
    for (const r of routes) m.set(r.id, r);
    return m;
  }, [routes]);

  // O(1) lookup for the stops layer's click handler. Stored in a ref so the
  // handler (registered once during map init) reads the latest map even if
  // the `stops` prop identity changes after Fast Refresh — without that we'd
  // also have to add `stops` to the init effect's dep array, which would
  // tear down and rebuild the whole maplibre instance on every HMR cycle.
  const stopsByIdRef = useRef<Map<string, Stop>>(new Map());
  useEffect(() => {
    const m = new Map<string, Stop>();
    for (const s of stops) m.set(s.id, s);
    stopsByIdRef.current = m;
  }, [stops]);

  // Stops visible in the current map viewport, sorted by distance to the
  // viewport's center. Capped to the batch limit so the panel + arrivals
  // call stay bounded even when the user zooms way out.
  const visibleStops = useMemo(() => {
    if (!viewport) return [];
    const ctr = { lat: viewport.centerLat, lon: viewport.centerLon };
    const inside: Array<Stop & { distance: number }> = [];
    for (const s of stops) {
      if (
        s.lon >= viewport.west && s.lon <= viewport.east &&
        s.lat >= viewport.south && s.lat <= viewport.north
      ) {
        inside.push({ ...s, distance: distanceMeters(ctr, s) });
      }
    }
    inside.sort((a, b) => a.distance - b.distance);
    return inside.slice(0, NEARBY_BATCH_LIMIT);
  }, [viewport, stops]);

  // Stable join of visible stop IDs — drives the arrivals effect without
  // re-firing on every micro-pan that leaves the set unchanged.
  const visibleStopsKey = useMemo(
    () => visibleStops.map((s) => s.id).join(','),
    [visibleStops],
  );

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocStatus('unavailable');
      setOrigin(FALLBACK_ORIGIN);
      return;
    }
    // Geolocation requires a secure context (HTTPS or localhost). On a LAN
    // IP like 192.168.x.x:3000 the API silently fails — surface it instead.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setLocStatus('denied');
      setLocError(
        `Geolocation blocked: page is loaded over insecure ${window.location.protocol}//${window.location.host}. ` +
        `Open the site as http://localhost:3000 (not the LAN IP) or use HTTPS.`,
      );
      return;
    }
    setLocStatus('requesting');
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocStatus('granted');
      },
      (err) => {
        setLocStatus('denied');
        // Surface the actual reason — without this Windows users have no
        // way to tell whether they denied permission, OS Location Service
        // is off, the network position lookup timed out, etc.
        const why =
          err.code === 1
            ? 'Permission denied. Click the lock icon in the address bar → Site settings → Location → Allow, then retry.'
            : err.code === 2
              ? 'Position unavailable. On Windows 10: open Settings → Privacy → Location and turn ON "Location service" + "Let apps access your location" + your browser. Then retry.'
              : err.code === 3
                ? 'Timed out. Move near a window (better GPS/Wi-Fi positioning) and retry.'
                : err.message || 'Unknown geolocation error.';
        setLocError(why);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, []);

  const useDowntown = useCallback(() => {
    setOrigin(FALLBACK_ORIGIN);
    if (locStatus === 'prompt') setLocStatus('denied'); // skip path also lands here
  }, [locStatus]);

  // ----- Map init (runs once) -----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [FALLBACK_ORIGIN.lon, FALLBACK_ORIGIN.lat],
      zoom: 13,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    // Viewport tracking — bound outside the style-load callback so the panel
    // populates even if tile/style loading is slow. Debounced so a continuous
    // drag/zoom doesn't fire setState on every animation frame.
    let viewportTimer: ReturnType<typeof setTimeout> | null = null;
    const pushViewport = () => {
      if (viewportTimer) clearTimeout(viewportTimer);
      viewportTimer = setTimeout(() => {
        const b = map.getBounds();
        const c = map.getCenter();
        setViewport({
          west: b.getWest(), south: b.getSouth(),
          east: b.getEast(), north: b.getNorth(),
          centerLon: c.lng, centerLat: c.lat,
        });
      }, VIEWPORT_DEBOUNCE_MS);
    };
    map.on('moveend', pushViewport);
    map.on('load', pushViewport);
    // Prime once now so the panel has a viewport before any pan/zoom.
    requestAnimationFrame(() => requestAnimationFrame(pushViewport));

    map.on('load', () => {
      // Empty sources up front; effects below populate them when `origin` is set.
      map.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'radius-fill',
        type: 'fill',
        source: 'radius',
        paint: { 'fill-color': '#1e90ff', 'fill-opacity': 0.06 },
      });
      map.addLayer({
        id: 'radius-line',
        type: 'line',
        source: 'radius',
        paint: { 'line-color': '#1e90ff', 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.6 },
      });

      map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'stops-point',
        type: 'circle',
        source: 'stops',
        paint: {
          'circle-color': '#fff',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 7, 18, 9],
          'circle-stroke-color': '#1e90ff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'stops-label',
        type: 'symbol',
        source: 'stops',
        minzoom: 16,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-font': ['Noto Sans Regular', 'Open Sans Regular', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      });

      map.addSource('origin', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'origin-pulse',
        type: 'circle',
        source: 'origin',
        paint: {
          'circle-color': '#1e90ff',
          'circle-opacity': 0.18,
          'circle-radius': 22,
        },
      });
      map.addLayer({
        id: 'origin-dot',
        type: 'circle',
        source: 'origin',
        paint: {
          'circle-color': '#1e90ff',
          'circle-radius': 7,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2.5,
        },
      });

      map.addSource('vehicles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'vehicles-circle',
        type: 'circle',
        source: 'vehicles',
        paint: {
          'circle-color': ['get', 'routeColor'],
          'circle-radius': 16,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'vehicles-label',
        type: 'symbol',
        source: 'vehicles',
        layout: {
          'text-field': ['get', 'routeShort'],
          'text-size': 15,
          'text-font': ['Noto Sans Bold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': ['get', 'routeText'] },
      });

      map.on('click', 'stops-point', (e) => {
        const f = e.features?.[0] as MapGeoJSONFeature | undefined;
        if (!f) return;
        const id = f.properties?.id as string;
        const stop = stopsByIdRef.current.get(id);
        if (stop) setSelectedStop(stop);
      });
      map.on('mouseenter', 'stops-point', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'stops-point', () => { map.getCanvas().style.cursor = ''; });

      // Push every stop into the source once; MapLibre culls offscreen
      // points on the GPU, so 2351 points cost nothing visible. The panel
      // and arrivals API still filter by viewport for the human-facing list.
      const stopsSrc0 = map.getSource('stops') as GeoJSONSource | undefined;
      if (stopsSrc0) stopsSrc0.setData(stopsToGeoJSON(stops));

      mapReadyRef.current = true;
      map.fire('app:ready');
    });

    const ro = new ResizeObserver(() => { map.resize(); });
    ro.observe(containerRef.current);
    requestAnimationFrame(() => map.resize());

    return () => {
      if (viewportTimer) clearTimeout(viewportTimer);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
    // Mount once — `stops` is read through stopsByIdRef so we don't need to
    // tear down maplibre when the prop identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Push origin + radius + stops + camera fit when origin changes -----
  useEffect(() => {
    if (!origin) return;
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // Reference circle stays anchored to the user — it's a "1 km from
      // you" visual cue, not a filter for what shows up in the panel.
      const radiusSrc = map.getSource('radius') as GeoJSONSource | undefined;
      if (radiusSrc) {
        radiusSrc.setData({ type: 'FeatureCollection', features: [circlePolygon(origin, RADIUS_METERS)] });
      }

      const originSrc = map.getSource('origin') as GeoJSONSource | undefined;
      if (originSrc) {
        originSrc.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature', properties: {},
            geometry: { type: 'Point', coordinates: [origin.lon, origin.lat] },
          }],
        });
      }

      // Initial camera fit centered on the user with the 1 km circle in view.
      const latDeg = RADIUS_METERS / 111_320;
      const lonDeg = RADIUS_METERS / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
      map.fitBounds(
        [[origin.lon - lonDeg, origin.lat - latDeg], [origin.lon + lonDeg, origin.lat + latDeg]],
        { padding: 32, duration: 600 },
      );
    };

    if (mapReadyRef.current) {
      apply();
      return;
    }
    map.once('app:ready', apply);
    // If origin changes again before the map is ready, drop the stale
    // listener so we don't run an outdated apply() with a previous origin.
    return () => { map.off('app:ready', apply); };
  }, [origin]);

  // ----- Batch poll arrivals for all stops in view -----
  // Re-runs whenever the visible stop set actually changes (memoized by ID
  // join). One request per cycle returns predictions for every visible stop.
  useEffect(() => {
    if (!visibleStopsKey) { setNearbyArrivals({}); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      if (!alive) return;
      try {
        const r = await fetch(`/api/transit/arrivals?stops=${encodeURIComponent(visibleStopsKey)}`, { cache: 'no-store' });
        const data = (await r.json()) as { arrivals: Record<string, Arrival[]> };
        if (alive) setNearbyArrivals(data.arrivals ?? {});
      } catch {/* keep last good */}
      if (alive) timer = setTimeout(load, ARRIVAL_POLL_MS);
    }
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [visibleStopsKey]);

  const focusStop = useCallback((stop: Stop) => {
    const map = mapRef.current;
    if (map) map.easeTo({ center: [stop.lon, stop.lat], zoom: Math.max(map.getZoom(), 16), duration: 400 });
    setSelectedStop(stop);
  }, []);

  // ----- Vehicle polling (always; users want to see buses approaching) -----
  // Stops scheduling new ticks while the tab is hidden, and resumes
  // immediately when the user returns — so a backgrounded tab incurs zero
  // ongoing cost (no skipped-fetch timers, no setState churn).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (!alive || document.visibilityState !== 'visible') return;
      try {
        const r = await fetch('/api/transit/vehicles', { cache: 'no-store' });
        const data = (await r.json()) as { vehicles: Vehicle[] };
        if (alive && mapRef.current) {
          const src = mapRef.current.getSource('vehicles') as GeoJSONSource | undefined;
          if (src) src.setData(vehiclesToGeoJSON(data.vehicles ?? [], routesById));
          setVehicleCount(data.vehicles?.length ?? 0);
          setLastUpdated(Date.now());
        }
      } catch {/* swallow — next tick retries */}
      if (alive && document.visibilityState === 'visible') {
        timer = setTimeout(tick, VEHICLE_POLL_MS);
      }
    }
    tick();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !timer) tick();
      if (document.visibilityState !== 'visible' && timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [routesById]);

  // ----- Arrivals fetch + poll while popover open -----
  useEffect(() => {
    if (!selectedStop) { setArrivals(null); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      if (!alive) return;
      setArrivalsLoading(true);
      try {
        const r = await fetch(`/api/transit/arrivals?stops=${encodeURIComponent(selectedStop!.id)}`, { cache: 'no-store' });
        const data = (await r.json()) as { arrivals: Record<string, Arrival[]> };
        if (alive) setArrivals(data.arrivals?.[selectedStop!.id] ?? []);
      } catch {
        if (alive) setArrivals([]);
      } finally {
        if (alive) setArrivalsLoading(false);
      }
      if (alive) timer = setTimeout(load, ARRIVAL_POLL_MS);
    }
    load();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [selectedStop]);

  // ----- Render -----
  const showPrompt = origin === null;

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* On mobile, the stat chip sits on top of the map (above the bottom
          sheet). On desktop it disappears here and is shown inside the
          panel header instead — see the header strip below. */}
      {!showPrompt && (
        <div className="sm:hidden absolute top-2 left-2 bg-card/95 backdrop-blur px-3 py-1.5 rounded-full text-[11px] text-foreground shadow-md border border-border pointer-events-none">
          <span className="font-semibold text-sky-600 dark:text-sky-400">{visibleStops.length}</span>
          <span className="opacity-60"> stops · </span>
          <span className="font-semibold text-sky-600 dark:text-sky-400">{vehicleCount}</span>
          <span className="opacity-60"> buses live</span>
        </div>
      )}

      {/* Nearby-arrivals panel.
          Mobile: bottom sheet with peek/expanded states. Default peek (just
            the header strip) so the map owns the screen. Tap header to expand
            to 75vh; tap again to collapse.
          Desktop: always-on side panel pinned top-to-bottom, panelOpen flag
            is ignored. */}
      {!showPrompt && !selectedStop && visibleStops.length > 0 && (
        <div
          ref={panelRef}
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          className="absolute left-0 right-0 bottom-0 sm:left-2 sm:right-auto sm:top-2 sm:bottom-2 sm:w-[34rem] bg-card/95 backdrop-blur text-foreground rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden will-change-transform touch-pan-y"
          style={
            isDesktop
              ? undefined
              : {
                  // iOS-style bottom sheet: the panel is always 75vh tall,
                  // and slides down via translateY when collapsed so only the
                  // ~3.5rem header peeks above the screen edge. translate is
                  // GPU-accelerated and the easing curve mirrors UIKit's
                  // standard sheet animation.
                  //
                  // Property order matters: React applies inline style props
                  // in object-iteration order via `element.style.setProperty`.
                  // We list `transition` BEFORE `transform` so the browser
                  // has a transition rule set when the new transform value
                  // arrives — otherwise the change snaps without animating.
                  height: '75vh',
                  transition: 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)',
                  transform: `translateY(${panelOpen ? 0 : peekPx}px)`,
                }
          }
        >
            <button
              data-sheet-handle
              onClick={() => {
                if (performance.now() < suppressClickUntilRef.current) return;
                setPanelOpen((v) => !v);
              }}
              className="relative flex items-center gap-2 px-4 pt-3 pb-3 sm:pt-3 border-b border-border text-left hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors shrink-0 touch-none"
              aria-expanded={panelOpen}
              aria-controls="nearby-list"
            >
              {/* Grabber affordance — visible only on mobile, signals the
                  header is a draggable/tappable sheet handle. */}
              <span
                aria-hidden
                className="sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-foreground/20"
              />
              <span className="text-sky-500">🚌</span>
              <span className="text-sm font-semibold">Nearby — next buses</span>
              {/* Mobile: live preview in the header so the peek bar still has
                  value. Desktop: full stats — same line. */}
              <span className="ml-auto text-[11px] text-foreground/50 tabular-nums">
                <span className="font-semibold text-sky-600 dark:text-sky-400">{visibleStops.length}</span> stops ·{' '}
                <span className="font-semibold text-sky-600 dark:text-sky-400">{vehicleCount}</span> buses
              </span>
              <span className="sm:hidden text-[11px] text-foreground/40 ml-1">{panelOpen ? '▾' : '▴'}</span>
            </button>
            {/* List always mounted; collapsed by the outer max-height clip so
                the slide animation stays smooth. */}
              <ul id="nearby-list" className="overflow-y-auto divide-y divide-border/60 overscroll-contain">
                {visibleStops.map((stop) => {
                  const list = nearbyArrivals[stop.id] ?? [];
                  return (
                    <li key={stop.id}>
                      <button
                        onClick={() => focusStop(stop)}
                        className="w-full text-left px-4 py-2.5 hover:bg-sky-50 dark:hover:bg-sky-950/30 active:bg-sky-100 dark:active:bg-sky-900/40 flex items-start gap-3 transition-colors"
                      >
                        <span className="shrink-0 text-xl tabular-nums font-semibold text-sky-600 dark:text-sky-400 mt-0.5 w-16">
                          {stop.distance < 1000 ? `${Math.round(stop.distance)} m` : `${(stop.distance / 1000).toFixed(1)} km`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">
                            {stop.code && (
                              <span className="font-mono font-bold text-sky-600 dark:text-sky-400 mr-1.5">
                                {stop.code}
                              </span>
                            )}
                            {/* Halifax names often end with "(6107)" — strip
                                that since the code is now shown up front. */}
                            {stop.name.replace(/\s*\(\d+\)\s*$/, '')}
                          </div>
                          {list.length === 0 ? (
                            <div className="text-[11px] text-foreground/40 mt-0.5 italic">No upcoming buses</div>
                          ) : (
                            <ul className="mt-1.5 space-y-1">
                              {list.slice(0, 3).map((a, i) => {
                                const r = a.routeId ? routesById.get(a.routeId) : undefined;
                                const dest = a.headsign ?? r?.long ?? '';
                                return (
                                  <li
                                    key={`${a.tripId ?? i}-${a.time}`}
                                    className="flex items-center gap-2 text-[11px]"
                                  >
                                    <span
                                      className="inline-block shrink-0 min-w-[2.25rem] text-center text-base font-extrabold py-0.5 px-1.5 rounded-md"
                                      style={{ background: ROUTE_PILL_BG, color: ROUTE_PILL_TEXT }}
                                    >
                                      {r?.short ?? a.routeId ?? '?'}
                                    </span>
                                    <span className="flex-1 min-w-0 truncate text-sm leading-snug text-foreground/85">
                                      <span className="opacity-50 mr-1">→</span>
                                      {dest || <span className="italic opacity-50">unknown destination</span>}
                                    </span>
                                    <span className="shrink-0 tabular-nums font-semibold text-foreground">
                                      {formatEta(a.time)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
        </div>
      )}

      {!showPrompt && locStatus !== 'granted' && (
        <button
          onClick={requestLocation}
          className="absolute top-2 right-14 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md transition-colors"
        >
          📍 Use my location
        </button>
      )}

      {showPrompt && (
        <div className="absolute inset-0 bg-sky-950/40 backdrop-blur-sm grid place-items-center p-6 z-20">
          <div className="bg-card text-foreground rounded-2xl shadow-2xl border border-border max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-sky-100 dark:bg-sky-900/40 grid place-items-center text-3xl">
              📍
            </div>
            <h2 className="text-lg font-semibold mb-1.5">Show buses near you</h2>
            <p className="text-xs text-foreground/60 mb-5 leading-relaxed">
              We'll center the map on you and show every Halifax Transit stop within{' '}
              <span className="font-semibold text-sky-600 dark:text-sky-400">800 m</span>.
              Pan or zoom to see more. Your location stays on your device.
            </p>
            {locStatus === 'requesting' ? (
              <div className="text-xs text-foreground/60 py-3">Getting your location…</div>
            ) : (
              <>
                <button
                  onClick={requestLocation}
                  className="w-full bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white text-sm font-semibold py-2.5 rounded-xl mb-2 shadow-sm transition-colors"
                >
                  Use my location
                </button>
                <button
                  onClick={useDowntown}
                  className="w-full text-xs text-foreground/55 hover:text-foreground py-2 transition-colors"
                >
                  Skip — show downtown Halifax
                </button>
                {locStatus === 'denied' && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 leading-relaxed text-left">
                    {locError ?? "Location was blocked. You can enable it in your browser's site settings and tap again."}
                  </p>
                )}
                {locStatus === 'unavailable' && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                    This browser doesn't support geolocation.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {selectedStop && (
        <div className="absolute bottom-0 left-0 right-0 sm:left-2 sm:right-auto sm:bottom-2 sm:w-96 max-h-[60vh] overflow-auto bg-card/95 backdrop-blur text-foreground rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border">
          <div className="flex items-start gap-2 px-4 py-3 border-b border-border sticky top-0 bg-card/95 backdrop-blur">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight text-foreground">{selectedStop.name}</div>
              <div className="text-[11px] text-foreground/55 mt-0.5">Stop {selectedStop.code ?? selectedStop.id}</div>
            </div>
            <button
              onClick={() => setSelectedStop(null)}
              className="text-foreground/50 hover:text-foreground hover:bg-sky-50 dark:hover:bg-sky-950/40 w-7 h-7 grid place-items-center rounded-full text-lg leading-none transition-colors"
              aria-label="Close"
            >×</button>
          </div>

          <div className="p-3">
            {arrivalsLoading && arrivals === null && (
              <div className="text-xs text-foreground/55 px-1 py-2">Loading arrivals…</div>
            )}
            {arrivals && arrivals.length === 0 && (
              <div className="text-xs text-foreground/55 px-1 py-2 italic">No predicted arrivals in the live feed.</div>
            )}
            {arrivals && arrivals.length > 0 && (
              <ul className="divide-y divide-border/60">
                {arrivals.map((a, i) => {
                  const r = a.routeId ? routesById.get(a.routeId) : undefined;
                  return (
                    <li
                      key={`${a.tripId ?? i}-${a.stopId}-${a.time}`}
                      className="flex items-center gap-2.5 py-2 text-sm"
                    >
                      <span
                        className="inline-block min-w-[3rem] text-center text-xl font-extrabold py-1 px-2 rounded-md shadow-sm shrink-0"
                        style={{ background: ROUTE_PILL_BG, color: ROUTE_PILL_TEXT }}
                      >
                        {r?.short ?? a.routeId ?? '?'}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-xs text-foreground/75">
                        <span className="opacity-50 mr-1">→</span>
                        {a.headsign ?? r?.long ?? <span className="italic opacity-50">unknown</span>}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground shrink-0">{formatEta(a.time)}</span>
                      {typeof a.delay === 'number' && a.delay !== 0 && (
                        <span
                          className={`text-[10px] tabular-nums font-medium px-1.5 py-0.5 rounded ${
                            a.delay > 0
                              ? 'text-red-600 bg-red-50 dark:text-red-300 dark:bg-red-950/40'
                              : 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40'
                          }`}
                        >
                          {a.delay > 0 ? '+' : ''}{Math.round(a.delay / 60)}m
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
