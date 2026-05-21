"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const BASE = "https://cdn.halifax.ca/webcam/webcamImage1.jpg";
const SOURCE_URL = "https://www.halifax.ca/parks-recreation/programs-activities/outdoor-recreation/emera-oval";
const REFRESH_MS = 10_000; // halifax.ca refreshes the file every few seconds; 10s keeps us fresh without hammering

export default function EmeraOvalWebcam() {
  // History: an earlier version of this file routed the cam through
  // next/image, citing Chrome's ORB. Verified on cdn.halifax.ca: the
  // response is `Content-Type: image/jpeg`, which ORB *never* blocks
  // regardless of CORS — that was a misdiagnosis. Plain <img> works.
  //
  // Going through next/image was costing real money: every cache-busted
  // ?t=... URL counted as a new Vercel Image Optimization transformation,
  // ~360 per active hour of viewing. We now use Image with `unoptimized`
  // so the browser fetches the CDN directly and Vercel charges nothing.
  const [t, setT] = useState(0);

  useEffect(() => {
    setT(Date.now());
    const id = setInterval(() => setT(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // Skip rendering until mount so SSR + first client render agree (no hydration mismatch).
  if (t === 0) return null;

  return (
    <section className="mt-6">
      <p className="text-xl font-semibold text-center text-foreground mb-3">📷 Emera Oval · live webcam</p>
      <div className="rounded-xl overflow-hidden border border-border shadow-sm bg-black aspect-video relative">
        <Image
          src={`${BASE}?t=${t}`}
          alt="Emera Oval live webcam, Halifax Common"
          fill
          sizes="(min-width: 1024px) 64rem, 100vw"
          className="object-cover"
          // Skip Vercel's image optimizer — see header comment. Every
          // cache-busted URL would otherwise be a billable transformation.
          unoptimized
        />
      </div>
      <p className="text-sm text-foreground/50 text-center mt-2">
        Refreshes every 10s · source{" "}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-500 hover:underline"
        >
          halifax.ca/emera-oval
        </a>
      </p>
    </section>
  );
}
