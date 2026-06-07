"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import PlaybackSpeedButton from "@/components/PlaybackSpeedButton";

// item.audio is a URL to /api/reddit-briefing/clip/<postId> served by the
// backend route — *not* a data: URL. iOS Safari refuses to play long
// `data:audio/mp4;base64,...` payloads (the m4a-in-mp4 MIME is ambiguous
// on Safari's data-URL fast path), so we hand it a plain HTTP stream
// instead, which it consumes natively the same way Mobile Safari plays
// any audio element with a remote src.

// 1-frame silent MP3 used to "unlock" the audio element on iOS Safari.
// Even with everything else right (URL src, user gesture, blob URLs,
// etc.), iOS sometimes refuses the first play() on an element that has
// never been played before. Playing a tiny silent clip synchronously
// inside the user gesture flips the element into "user-activated" state
// for the rest of the session — every subsequent play() works without
// further gestures. MP3 is universal on iOS.
const SILENT_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVV";

type Item = {
  // Stable identity for the playlist position. For the new per-post source
  // this is the Reddit post_id; for legacy `reddit_briefing` rows it's the
  // slot string ("morning"/"evening"/"late_night").
  slot: string;
  // Per-item display label. Set for the new per-post source (= post title).
  // Falls back to the legacy slot label below when null.
  label?: string | null;
  summary: string;
  postCount: number;
  createdAt: string;
  audio?: string | null;
  // Optional per-post metadata surfaced in the player meta row.
  flair?: string | null;
  score?: number | null;
  numComments?: number | null;
};
type Status = "idle" | "loading" | "ready" | "empty" | "error";

const LEGACY_SLOT_LABEL: Record<string, string> = {
  morning: "Midday pulse",
  evening: "Evening pulse",
  late_night: "Late-night pulse",
};

function itemLabel(item: Item): string {
  if (item.label) return item.label;
  return LEGACY_SLOT_LABEL[item.slot] ?? "Today's pulse";
}

export default function RedditBriefingPlayer() {
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplay = useRef(false);

  // Advance into the next clip when `current` moves (clip ended → next).
  // Play synchronously — no rAF — because iOS Safari already loses the
  // user-activation token across most async hops; adding another deferred
  // frame here makes it worse. The autoplay flag is set only after a click,
  // so this can't fire without a prior gesture.
  useEffect(() => {
    if (current < 0) return;
    if (autoplay.current) void audioRef.current?.play();
  }, [current]);

  const playable = useMemo(() => items.filter((i) => i.audio), [items]);

  // Per-clip durations. Populated incrementally by the main <audio>'s
  // loadedmetadata as each clip is actually loaded — the previous approach
  // used a side-channel `new Audio()` preload, which doesn't fire on iOS
  // Safari without a user gesture, leaving the progress bar invisible.
  const [durations, setDurations] = useState<Map<string, number>>(new Map());
  const [currentClipTime, setCurrentClipTime] = useState(0);

  const recordDuration = (slot: string) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(a.duration)) return;
    setDurations((prev) => {
      if (prev.get(slot) === a.duration) return prev;
      const next = new Map(prev);
      next.set(slot, a.duration);
      return next;
    });
  };

  const completedBefore = useMemo(() => {
    if (current < 0) return 0;
    let sum = 0;
    for (let i = 0; i < current; i++) {
      const it = items[i];
      if (it?.audio) sum += durations.get(it.slot) ?? 0;
    }
    return sum;
  }, [items, current, durations]);

  const totalDuration = useMemo(() => {
    let sum = 0;
    for (const it of items) if (it.audio) sum += durations.get(it.slot) ?? 0;
    return sum;
  }, [items, durations]);

  const totalProgress = completedBefore + currentClipTime;
  const progressPct = totalDuration > 0 ? Math.min(100, (totalProgress / totalDuration) * 100) : 0;

  const clipBoundaries = useMemo(() => {
    if (totalDuration <= 0) return [];
    const out: number[] = [];
    let cum = 0;
    for (let i = 0; i < playable.length - 1; i++) {
      cum += durations.get(playable[i].slot) ?? 0;
      out.push((cum / totalDuration) * 100);
    }
    return out;
  }, [playable, durations, totalDuration]);

  const listen = async () => {
    track("reddit_briefing_play");

    // iOS unlock — synchronously prime the audio element with a tiny
    // silent MP3 inside the click handler. After this, the element is
    // flagged as "user-activated" on iOS Safari and subsequent play()
    // calls (after our await + setState) succeed without re-gesturing.
    const primeEl = audioRef.current;
    if (primeEl) {
      try {
        primeEl.src = SILENT_MP3;
        primeEl.load();
        const p = primeEl.play();
        if (p && typeof p.then === "function") {
          // Don't wait — we just need the .play() call to register in
          // the gesture window. Errors here are expected if iOS still
          // says no on the prime; we'll let the real play() report.
          p.catch(() => {});
        }
      } catch {
        // ignore prime failures — the real play() will report errors
      }
    }

    if (items.some((i) => i.audio)) {
      autoplay.current = true;
      const first = items.findIndex((i) => i.audio);
      if (first < 0) return;
      if (current === first) void audioRef.current?.play();
      else setCurrent(first);
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/reddit-briefing");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: Item[] };
      if (!data.items?.length) {
        setStatus("empty");
        return;
      }
      setItems(data.items);
      setStatus("ready");
      autoplay.current = true;
      const first = data.items.findIndex((i) => i.audio);
      if (first < 0) return;
      // Set src + call play() directly on the element here, still in the same
      // async function as the click. iOS Safari preserves the user-activation
      // token across an awaited fetch but loses it across the additional
      // setState → effect hop, so we can't wait for React to bind src for us.
      const audioEl = audioRef.current;
      const firstAudio = data.items[first].audio;
      if (audioEl && firstAudio) {
        audioEl.src = firstAudio;
        audioEl.load();
        void audioEl.play().catch((err) => {
          console.warn("[reddit-briefing] play rejected:", err);
        });
      }
      setCurrent(first);
    } catch (e) {
      console.error("[reddit-briefing] listen failed", e);
      setStatus("error");
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      autoplay.current = true;
      void a.play();
    } else {
      autoplay.current = false;
      a.pause();
    }
  };

  const onEnded = () => {
    let next = current + 1;
    while (next < items.length && !items[next].audio) next++;
    if (next < items.length) setCurrent(next);
    else {
      autoplay.current = false;
      setPlaying(false);
      setCurrent(-1);
    }
  };

  const loading = status === "loading";
  const curItem = current >= 0 ? items[current] : null;

  return (
    <div className="mb-4 space-y-2">
      {current < 0 && (
        <button
          onClick={listen}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-600 dark:text-orange-400 transition-colors disabled:opacity-60"
        >
          {loading ? (
            <span className="w-4 h-4 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          ) : (
            <span className="grid place-items-center w-6 h-6 rounded-full bg-orange-500 text-white shrink-0">
              <svg className="w-3 h-3 translate-x-px" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          )}
          Listen to today&apos;s Reddit pulse
        </button>
      )}

      {status === "empty" && (
        <p className="text-xs text-foreground/40 text-center py-1">
          No Reddit pulse yet — check back after 11:30 AM, 6 PM or 11 PM.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-foreground/40 text-center py-1">Reddit pulse unavailable right now.</p>
      )}

      {curItem && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 px-3 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="grid place-items-center w-9 h-9 rounded-full bg-orange-500 hover:bg-orange-600 text-white shrink-0 transition-colors"
            >
              {playing ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 translate-x-px" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-foreground/40 truncate">
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {playable.findIndex((p) => p.slot === curItem.slot) + 1} of {playable.length}
                </span>
                {curItem.flair ? <> · {curItem.flair}</> : null}
                {typeof curItem.score === "number" ? <> · ▲{curItem.score}</> : null}
                {typeof curItem.numComments === "number" && curItem.numComments > 0
                  ? <> · {curItem.numComments} comments</>
                  : null}
              </p>
              <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                {itemLabel(curItem)}
              </p>
              <p className="text-xs text-foreground/60 leading-snug line-clamp-2 mt-0.5">
                {curItem.summary}
              </p>
            </div>
            <PlaybackSpeedButton audioRef={audioRef} />
          </div>

          {totalDuration > 0 && (
            <div className="mt-2.5">
              <div className="relative h-1.5 rounded-full bg-orange-500/15 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-orange-500 transition-[width] duration-100 ease-linear"
                  style={{ width: `${progressPct}%` }}
                />
                {clipBoundaries.map((pct, i) => (
                  <span
                    key={i}
                    className="absolute inset-y-0 w-px bg-background/70"
                    style={{ left: `${pct}%` }}
                    aria-hidden
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-foreground/40 mt-1 tabular-nums">
                <span>{fmtTime(totalProgress)}</span>
                <span>{fmtTime(totalDuration)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <audio
        ref={audioRef}
        src={curItem?.audio ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
        onLoadStart={() => setCurrentClipTime(0)}
        onLoadedMetadata={() => curItem && recordDuration(curItem.slot)}
        onTimeUpdate={() => setCurrentClipTime(audioRef.current?.currentTime ?? 0)}
        onError={(e) => {
          const a = e.currentTarget;
          console.warn(
            "[reddit-briefing] audio error",
            a.error?.code,
            a.error?.message,
            "src=", a.src.slice(0, 80),
          );
        }}
        preload="auto"
        playsInline
        hidden
      />
    </div>
  );
}

function fmtTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
