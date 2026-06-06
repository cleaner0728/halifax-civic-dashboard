"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { usePolledImage } from "./usePolledImage";

// Desktop-only "wall" of the top webcams — all four rendered live at once
// in a single row across the top of the City Live board. The mobile
// HalifaxWebcams (single cam + pill switcher) is untouched.

type Cam =
  | {
      kind: "image";
      source: string;
      name: string;
      imageUrl: (t: number) => string;
      refreshMs: number;
    }
  | {
      kind: "video";
      source: string;
      name: string;
      streamUrl: string;
    };

const hhbUrl = (slug: string) => (t: number) =>
  `https://halifaxharbourbridges.ca/wp-content/traffic_cam_images/${slug}.png?time=${t}`;

// The first four cams in the HalifaxWebcams roster — all four bridge
// directions. The desktop wall keeps the same set so users get a one-glance
// view of the bridges instead of clicking through a pill switcher.
const WALL_CAMS: Cam[] = [
  {
    kind: "image",
    imageUrl: hhbUrl("macdonald-halifax-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/macdonald-bridge-halifax-bound",
    name: "MacDonald (Halifax)",
  },
  {
    kind: "image",
    imageUrl: hhbUrl("macdonald-dartmouth-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/macdonald-bridge-dartmouth-bound",
    name: "MacDonald (Dartmouth)",
  },
  {
    kind: "image",
    imageUrl: hhbUrl("mackay-halifax-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/mackay-bridge-halifax-bound",
    name: "MacKay (Halifax)",
  },
  {
    kind: "image",
    imageUrl: hhbUrl("mackay-dartmouth-bound"),
    refreshMs: 10_000,
    source: "https://www.novascotiawebcams.com/webcams/mackay-bridge-dartmouth-bound",
    name: "MacKay (Dartmouth)",
  },
];

function ImageCam({
  camId,
  imageUrl,
  refreshMs,
}: {
  camId: string;
  imageUrl: (t: number) => string;
  refreshMs: number;
}) {
  const t = usePolledImage(refreshMs);
  if (t === 0) return null;
  return (
    <Image
      key={camId}
      src={imageUrl(t)}
      alt="live webcam"
      fill
      sizes="(min-width: 1920px) 25vw, (min-width: 1280px) 25vw, 50vw"
      className="object-cover"
      unoptimized
    />
  );
}

function VideoCam({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

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

export default function HalifaxWebcamWall() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {WALL_CAMS.map((cam) => (
        <a
          key={cam.name}
          href={cam.source}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative aspect-video rounded-xl overflow-hidden border border-border bg-black shadow-sm hover:shadow-md transition-shadow"
        >
          {cam.kind === "image" ? (
            <ImageCam camId={cam.name} imageUrl={cam.imageUrl} refreshMs={cam.refreshMs} />
          ) : (
            <VideoCam streamUrl={cam.streamUrl} />
          )}

          {/* Name overlay — gradient backdrop so the label is legible against
              any frame (sky-bright day shots, night shots, headlight glare). */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-3 py-2">
            <p className="text-xs font-semibold text-white tracking-wide">
              {cam.name}
            </p>
          </div>

          {/* Live dot — subtle confidence that this is a real feed, not a
              static image. */}
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
        </a>
      ))}
    </div>
  );
}
