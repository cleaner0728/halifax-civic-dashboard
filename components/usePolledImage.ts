"use client";

import { useEffect, useState } from "react";

// Returns a monotonically increasing timestamp that ticks every `refreshMs`
// while the document is visible. Use it as a cache-buster (`?t=${t}`) on
// polled webcam stills so the browser actually re-fetches each frame.
//
// Pauses on `visibilitychange` so a backgrounded tab doesn't burn bandwidth
// against the upstream CDN. Resumes with an immediate refresh on focus so
// the user never sees a frame older than one tick after they look back.
//
// Returns 0 on the server / before mount; consumers should skip rendering
// the image until the value is non-zero to avoid hydration mismatches.
export function usePolledImage(refreshMs: number): number {
  const [t, setT] = useState(0);

  useEffect(() => {
    let intervalId: number | null = null;
    const start = () => {
      setT(Date.now());
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = window.setInterval(() => setT(Date.now()), refreshMs);
    };
    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };
    if (document.visibilityState === "visible") start();
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshMs]);

  return t;
}
