"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Two render shapes:
//   - image: poll a still-frame URL on a fixed cadence. Each upstream sets
//     its own pace: Halifax Harbour Bridges PNGs refresh every ~10s; our
//     novascotiawebcams scraper route only finds a new preview UUID every
//     ~60s, so polling faster than that is wasted bandwidth.
//   - video: HLS live stream via hls.js (or Safari's native HLS).
//
// Storing the URL builder per-cam keeps the component agnostic of where the
// frame comes from. Some cams hit upstream directly; others go through
// /api/webcam-frame which works around a broken og_image endpoint.
type Cam =
  | {
      kind: "image";
      source: string;
      name: string;
      emoji: string;
      // Returns a cache-buster-stamped URL. Different upstreams use different
      // query-string conventions (`?time=` vs `?t=`); the builder hides that.
      imageUrl: (t: number) => string;
      refreshMs: number;
    }
  | {
      kind: "video";
      source: string;
      name: string;
      emoji: string;
      streamUrl: string;
    };

// Halifax Harbour Bridges' own traffic-cam script (loaded on their public
// /traffic/ page) polls these PNGs every 10s, which is the cadence the
// upstream actually refreshes at. Their og_image equivalents on
// novascotiawebcams.com are stuck for hours at a time — this URL pattern
// is the real source of truth.
const hhbUrl = (slug: string) => (t: number) =>
  `https://halifaxharbourbridges.ca/wp-content/traffic_cam_images/${slug}.png?time=${t}`;

// The Maritime Museum cam has no HHB equivalent — its only feed is via
// novascotiawebcams.com, where the canonical og_image.jpg is broken. Our
// route handler scrapes the freshest /previews/<slug>/<uuid>.jpg URL out
// of the upstream page's gallery JSON and proxies the bytes through.
const nswRouteUrl = (slug: string) => (t: number) =>
  `/api/webcam-frame/${slug}?t=${t}`;

const CAMS: Cam[] = [
  {
    kind: "video",
    streamUrl: "https://streaming-1.novascotiawebcams.com/live/kingswharf/playlist.m3u8",
    source: "https://www.novascotiawebcams.com/webcams/halifax-waterfront",
    name: "Halifax Waterfront",
    emoji: "⚓",
  },
  {
    kind: "video",
    streamUrl: "https://streaming-1.novascotiawebcams.com/live/argylestreet/playlist.m3u8",
    source: "https://www.novascotiawebcams.com/webcams/argyle-street",
    name: "Argyle Street",
    emoji: "🍽️",
  },
  {
    kind: "video",
    streamUrl: "https://streaming-1.novascotiawebcams.com/live/westin/playlist.m3u8",
    source: "https://www.novascotiawebcams.com/webcams/pier-21",
    name: "Pier 21",
    emoji: "🛳️",
  },
  {
    kind: "video",
    streamUrl: "https://streaming-1.novascotiawebcams.com/live/armdale2/playlist.m3u8",
    source: "https://www.novascotiawebcams.com/webcams/armdale-roundabout-2",
    name: "Armdale Roundabout",
    emoji: "🚥",
  },
  {
    kind: "image",
    imageUrl: hhbUrl("macdonald-halifax-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/macdonald-bridge-halifax-bound",
    name: "MacDonald (Halifax)",
    emoji: "🌉",
  },
  {
    kind: "image",
    imageUrl: hhbUrl("macdonald-dartmouth-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/macdonald-bridge-dartmouth-bound",
    name: "MacDonald (Dartmouth)",
    emoji: "🌉",
  },
  {
    kind: "image",
    imageUrl: hhbUrl("mackay-halifax-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/mackay-bridge-halifax-bound",
    name: "MacKay (Halifax)",
    emoji: "🌉",
  },
  {
    kind: "image",
    imageUrl: hhbUrl("mackay-dartmouth-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/mackay-bridge-dartmouth-bound",
    name: "MacKay (Dartmouth)",
    emoji: "🌉",
  },
  {
    kind: "image",
    imageUrl: nswRouteUrl("maritimemuseum"),
    refreshMs: 60_000,
    source: "https://www.novascotiawebcams.com/webcams/maritime-museum",
    name: "Maritime Museum",
    emoji: "🚢",
  },
];

function ImageCam({
  camId,
  imageUrl,
  refreshMs,
}: {
  // Stable per-cam ID. Used as the React key on the underlying <Image>
  // so React unmounts/remounts when the user switches between two image
  // cams (otherwise the previous frame would briefly show stretched into
  // the new aspect ratio while the new src loads).
  camId: string;
  imageUrl: (t: number) => string;
  refreshMs: number;
}) {
  const [t, setT] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Poll-and-replace at the per-cam cadence. Paused while the tab is hidden
  // so we don't burn requests in the background; resumes with an immediate
  // refresh on focus so the user never sees a frame older than one tick
  // after they look at the page.
  useEffect(() => {
    const start = () => {
      setT(Date.now());
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(() => setT(Date.now()), refreshMs);
    };
    const stop = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    if (document.visibilityState === "visible") start();
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [imageUrl, refreshMs]);

  if (t === 0) return null;
  const src = imageUrl(t);
  // Same-origin URLs (our own /api/... route) skip the next/image optimizer:
  // it rejects relative URLs with a 400, and we don't need it anyway —
  // ORB protection only matters for cross-origin fetches.
  const isSameOrigin = src.startsWith("/");
  return (
    <Image
      key={camId}
      src={src}
      alt="live webcam"
      fill
      sizes="(min-width: 1024px) 64rem, 100vw"
      className="object-cover"
      // Cross-origin cams (HHB) MUST go through next/image so the browser
      // sees a same-origin response and Chrome's ORB doesn't silently drop
      // it. Same-origin cams (our own route) go direct.
      unoptimized={isSameOrigin}
    />
  );
}

function VideoCam({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari + iOS have native HLS support — pointing src at the .m3u8 is
    // enough. Chrome/Firefox/Edge don't, so we dynamically import hls.js
    // (~70KB) only when this code path actually runs. `cancelled` guards
    // against the user switching cams before the dynamic import resolves.
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let hlsInstance: any = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
    } else {
      import("hls.js").then(({ default: Hls }) => {
        if (cancelled || !Hls.isSupported()) return;
        hlsInstance = new Hls({ liveDurationInfinity: true });
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);
      });
    }

    return () => {
      cancelled = true;
      hlsInstance?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [streamUrl]);

  // No `controls` — this is a passive ambient live cam. No pause/seek/volume
  // makes sense for a 24/7 live stream with no audio. Users who want a full
  // player can follow the source link below.
  return (
    <video
      ref={videoRef}
      className="w-full h-full object-cover"
      autoPlay
      muted
      playsInline
    />
  );
}

export default function HalifaxWebcams() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = CAMS[activeIndex];

  return (
    <section className="mt-6">
      <p className="text-xl font-semibold text-center text-foreground mb-3">
        {active.emoji} {active.name}
      </p>
      <div
        // Re-key on cam switch so the player fully unmounts/remounts. Without
        // this the <video> element keeps the previous cam's frame visible
        // while the new HLS connects, which makes the up-top title look
        // "stuck on the old cam" even though it changed immediately.
        key={active.name}
        className="rounded-xl overflow-hidden border border-border shadow-sm bg-black aspect-video relative"
      >
        {active.kind === "image" ? (
          <ImageCam camId={active.name} imageUrl={active.imageUrl} refreshMs={active.refreshMs} />
        ) : (
          <VideoCam streamUrl={active.streamUrl} />
        )}
      </div>
      {/* Pill switcher lives BELOW the player so 9+ cams can wrap to multiple
          rows on narrow screens without covering the frame. */}
      <div className="flex flex-wrap gap-1.5 justify-center mt-3">
        {CAMS.map((c, i) => (
          <button
            key={c.name}
            onClick={() => setActiveIndex(i)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition border ${
              activeIndex === i
                ? "bg-foreground text-background border-foreground shadow"
                : "bg-card text-foreground/70 border-border hover:bg-foreground/5"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="text-sm text-foreground/50 text-center mt-3">
        <a
          href={active.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-500 hover:underline"
        >
          View live stream on novascotiawebcams.com →
        </a>
      </p>
    </section>
  );
}
