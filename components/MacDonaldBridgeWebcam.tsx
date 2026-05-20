"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// novascotiawebcams.com's og:image is a fresh JPEG snapshot updated roughly
// once a minute. Cache-Control on the response is 60s so we match that here.
const BASE = "https://images.novascotiawebcams.com/macdonald-halifax/og_image.jpg";
const SOURCE_URL = "https://www.novascotiawebcams.com/webcams/macdonald-bridge-halifax-bound";
const REFRESH_MS = 60_000;

export default function MacDonaldBridgeWebcam() {
  const [t, setT] = useState(0);

  useEffect(() => {
    setT(Date.now());
    const id = setInterval(() => setT(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (t === 0) return null;

  return (
    <section className="mt-6">
      <p className="text-xl font-semibold text-center text-foreground mb-3">
        🌉 MacDonald Bridge · Halifax bound
      </p>
      <div className="rounded-xl overflow-hidden border border-border shadow-sm bg-black aspect-video relative">
        <Image
          src={`${BASE}?t=${t}`}
          alt="MacDonald Bridge live webcam, Halifax bound"
          fill
          sizes="(min-width: 1024px) 64rem, 100vw"
          className="object-cover"
        />
      </div>
      <p className="text-sm text-foreground/50 text-center mt-2">
        Refreshes every minute · source{" "}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-500 hover:underline"
        >
          novascotiawebcams.com
        </a>
      </p>
    </section>
  );
}
