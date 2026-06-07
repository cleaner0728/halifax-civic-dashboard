"use client";

import { useEffect, useState } from "react";

// A compact playback-speed pill for the briefing players. Tapping cycles
// 1× → 1.5× → 2× → 1×. Self-contained: it only needs the player's <audio>
// ref — it applies the rate to the element and re-applies it whenever a new
// clip loads (iOS Safari, and some others, reset playbackRate to 1 on a new
// source). The choice persists in localStorage and is shared across both
// players so the user's preference is consistent.

const SPEEDS = [1, 1.5, 2];
const STORAGE_KEY = "hfx-playback-rate-v1";

function label(rate: number): string {
  return rate === 1 ? "1×" : rate === 1.5 ? "1.5×" : "2×";
}

export default function PlaybackSpeedButton({
  audioRef,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
  const [rate, setRate] = useState(1);

  // Restore the saved speed on mount.
  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (SPEEDS.includes(saved)) setRate(saved);
  }, []);

  // Keep the element's playbackRate in sync with `rate` — immediately, and
  // again every time a new clip starts loading/playing (some browsers reset
  // it on a new source).
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = rate;
    const reapply = () => {
      if (a.playbackRate !== rate) a.playbackRate = rate;
    };
    a.addEventListener("loadedmetadata", reapply);
    a.addEventListener("play", reapply);
    return () => {
      a.removeEventListener("loadedmetadata", reapply);
      a.removeEventListener("play", reapply);
    };
  }, [audioRef, rate]);

  const cycle = () => {
    setRate((r) => {
      const next = SPEEDS[(SPEEDS.indexOf(r) + 1) % SPEEDS.length] ?? 1;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // private mode / storage disabled — speed still applies for this session
      }
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Playback speed ${label(rate)}, tap to change`}
      className="shrink-0 rounded-full border border-foreground/15 bg-foreground/5 hover:bg-foreground/10 px-2.5 py-1 text-xs font-semibold text-foreground/70 tabular-nums transition-colors"
    >
      {label(rate)}
    </button>
  );
}
