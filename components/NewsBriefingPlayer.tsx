"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { track } from "@vercel/analytics";
import { formatRelative } from "@/lib/date";
import BetaOnly from "@/components/BetaOnly";
import PlaybackSpeedButton from "@/components/PlaybackSpeedButton";
import { currentBriefingLang } from "@/lib/briefing-lang";

// Convert `data:audio/...` URLs into Blob URLs. iOS Safari occasionally
// refuses to start playback on long base64 audio data URLs even inside a
// user gesture; same-origin blob URLs sidestep that path entirely.
function dataUrlToBlobUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return dataUrl;
  const [, mime, b64] = match;
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime || "audio/mpeg" }));
}

type Item = {
  url: string;
  title: string;
  source: string | null;
  summary: string;
  pubDate: string | null;
  audio?: string | null;
};
type Status = "idle" | "loading" | "ready" | "error";

export default function NewsBriefingPlayer() {
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<Item[]>([]);
  const [listOpen, setListOpen] = useState(false);

  // playlist playback
  const [current, setCurrent] = useState(-1); // -1 = nothing playing
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const autoplay = useRef(false); // are we in "play through the list" mode?
  const loadedLang = useRef<"en" | "zh">("en"); // language of the loaded playlist

  // When the current index changes (e.g. a clip ended → next), play it.
  // Synchronous play — no rAF — to preserve iOS Safari's user-activation
  // token. autoplay.current is only set after a click so this can't fire
  // without a prior user gesture.
  useEffect(() => {
    if (current < 0) return;
    if (autoplay.current) void audioRef.current?.play();
  }, [current]);

  const playable = items.filter((i) => i.audio);

  // Per-clip durations, learned incrementally from the main <audio>'s
  // loadedmetadata as each clip plays. The previous side-channel `new Audio()`
  // preload doesn't fire on iOS Safari without a user gesture, leaving the
  // progress bar permanently hidden on iPhone.
  const [durations, setDurations] = useState<Map<string, number>>(new Map());
  const [currentClipTime, setCurrentClipTime] = useState(0);

  const recordDuration = (url: string) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(a.duration)) return;
    setDurations((prev) => {
      if (prev.get(url) === a.duration) return prev;
      const next = new Map(prev);
      next.set(url, a.duration);
      return next;
    });
  };

  // Cumulative duration of every clip strictly BEFORE the currently-playing one.
  const completedBefore = useMemo(() => {
    if (current < 0) return 0;
    let sum = 0;
    for (let i = 0; i < current; i++) {
      const it = items[i];
      if (it?.audio) sum += durations.get(it.url) ?? 0;
    }
    return sum;
  }, [items, current, durations]);

  const totalDuration = useMemo(() => {
    let sum = 0;
    for (const it of items) {
      if (it.audio) sum += durations.get(it.url) ?? 0;
    }
    return sum;
  }, [items, durations]);

  const totalProgress = completedBefore + currentClipTime;
  const progressPct =
    totalDuration > 0 ? Math.min(100, (totalProgress / totalDuration) * 100) : 0;

  // Tick-mark positions (one per inter-clip boundary). Skip the trailing edge
  // of the final clip — that's just 100% and needs no tick.
  const clipBoundaries = useMemo(() => {
    if (totalDuration <= 0) return [];
    const out: number[] = [];
    let cum = 0;
    for (let i = 0; i < playable.length - 1; i++) {
      cum += durations.get(playable[i].url) ?? 0;
      out.push((cum / totalDuration) * 100);
    }
    return out;
  }, [playable, durations, totalDuration]);

  // ── Load audio collection + start playing from the top ──
  const listen = async () => {
    track("news_briefing_play");
    const lang = currentBriefingLang();
    if (items.some((i) => i.audio) && loadedLang.current === lang) {
      // already loaded in this language — just (re)start
      startPlaylist();
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(lang === "zh" ? "/api/news-briefing?lang=zh" : "/api/news-briefing");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: Item[] };
      if (!data.items?.length) throw new Error("empty");
      // Convert data: URLs to Blob URLs (see helper at top of file).
      const blobItems: Item[] = data.items.map((it) => ({
        ...it,
        audio: it.audio ? dataUrlToBlobUrl(it.audio) : it.audio,
      }));
      loadedLang.current = lang;
      setItems(blobItems);
      // Don't open the summary list on Listen — playback shows only the
      // now-playing bar. The list is revealed only via the Read toggle.
      setStatus("ready");
      autoplay.current = true;
      const first = blobItems.findIndex((i) => i.audio);
      if (first < 0) return;
      // Prime the audio element synchronously here so iOS Safari sees the
      // play() inside the same async chain as the click. Waiting for the
      // setCurrent → effect → play() path loses user activation on iPhone.
      const audioEl = audioRef.current;
      const firstAudio = blobItems[first].audio;
      if (audioEl && firstAudio) {
        audioEl.src = firstAudio;
        audioEl.load();
        void audioEl.play().catch((err) => {
          console.warn("[briefing] play rejected:", err);
        });
      }
      setCurrent(first);
    } catch (e) {
      console.error("[briefing] listen failed", e);
      setStatus("error");
    }
  };

  const startPlaylist = () => {
    autoplay.current = true;
    const first = items.findIndex((i) => i.audio);
    if (first < 0) return;
    if (current === first) void audioRef.current?.play();
    else setCurrent(first);
  };

  // Revoke blob URLs when the items list changes or component unmounts.
  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.audio && it.audio.startsWith("blob:")) URL.revokeObjectURL(it.audio);
      });
    };
  }, [items]);

  // ── Load text-only collection (no audio cost) ──
  const read = async () => {
    if (items.length) { setListOpen((o) => !o); return; }
    track("news_briefing_read");
    setStatus("loading");
    try {
      const res = await fetch("/api/news-briefing?mode=text");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: Item[] };
      setItems(data.items ?? []);
      setListOpen(true);
      setStatus("ready");
    } catch (e) {
      console.error("[briefing] read failed", e);
      setStatus("error");
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { autoplay.current = true; void a.play(); }
    else { autoplay.current = false; a.pause(); }
  };

  const playItem = (idx: number) => {
    if (!items[idx]?.audio) return;
    autoplay.current = true;
    if (idx === current) void audioRef.current?.play();
    else setCurrent(idx);
  };

  const onEnded = () => {
    // advance to the next clip that has audio
    let next = current + 1;
    while (next < items.length && !items[next].audio) next++;
    if (next < items.length) setCurrent(next);
    else {
      // Playlist done — return to idle. Now-playing card unmounts and the
      // "Listen to briefing" CTA reappears so the user can restart.
      autoplay.current = false;
      setPlaying(false);
      setCurrent(-1);
    }
  };

  const loading = status === "loading";
  const curItem = current >= 0 ? items[current] : null;

  return (
    <div className="mb-4 space-y-2">
      {/* ── Buttons ──
          The big "Listen to briefing" CTA is suppressed while a playback
          session is active — the Now-playing card below already has its own
          play/pause control, and showing two big blue play buttons stacked is
          visual noise. The CTA returns once the playlist finishes (onEnded
          resets current to -1). */}
      <div className="flex gap-2">
        {current < 0 && (
          <button
            onClick={listen}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            ) : (
              <span className="grid place-items-center w-6 h-6 rounded-full bg-blue-500 text-white shrink-0">
                <svg className="w-3 h-3 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </span>
            )}
            Listen to briefing
          </button>
        )}

        <BetaOnly>
          <button
            onClick={read}
            disabled={loading}
            aria-label="Read summaries"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors shrink-0 ${
              listOpen ? "border-foreground/20 bg-foreground/8 text-foreground/70" : "border-border text-foreground/50 hover:text-foreground/70"
            } disabled:opacity-50`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">Read</span>
          </button>
        </BetaOnly>
      </div>

      {status === "error" && (
        <p className="text-xs text-foreground/40 text-center py-1">Briefing unavailable right now.</p>
      )}

      {/* ── Now-playing bar ── */}
      {curItem && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="grid place-items-center w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 text-white shrink-0 transition-colors"
            >
              {playing ? (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg className="w-4 h-4 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            {/* key={curItem.url} forces React to REMOUNT this block when the
                clip changes instead of updating text in place. Google Translate
                wraps these text nodes in <font> tags and the app's DOM guards
                no-op the in-place mutations React would use to update them — so
                without a remount the counter + title freeze on the first clip's
                translated value (English is unaffected; only translated mode
                breaks). Remounting hands GT fresh nodes to re-translate, keeping
                the readout in sync with playback. */}
            <div key={curItem.url} className="min-w-0 flex-1">
              <p className="text-[11px] text-foreground/40">
                Now playing · {playable.findIndex((p) => p.url === curItem.url) + 1} of {playable.length}
              </p>
              <p className="text-sm font-medium text-foreground truncate">{curItem.title}</p>
            </div>
            <PlaybackSpeedButton audioRef={audioRef} />
          </div>

          {/* Total-playlist progress — spans the entire briefing, not just the
              current clip. Thin ticks mark clip boundaries so the user can see
              where each article begins/ends. When the bar reaches 100%, every
              summary has been read. */}
          {totalDuration > 0 && (
            <div className="mt-2.5">
              <div className="relative h-1.5 rounded-full bg-blue-500/15 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500 transition-[width] duration-100 ease-linear"
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

      {/* ── Article summary list ── */}
      {listOpen && items.length > 0 && (
        <ul className="rounded-xl border border-border bg-card/60 divide-y divide-border overflow-hidden">
          {items.map((item, i) => {
            const isCur = i === current;
            return (
              <li key={item.url} className={isCur ? "bg-blue-500/8" : ""}>
                <div className="flex items-start gap-3 px-3 py-2.5">
                  {item.audio ? (
                    <button
                      onClick={() => playItem(i)}
                      aria-label="Play this summary"
                      className="grid place-items-center w-6 h-6 rounded-full bg-blue-500/15 hover:bg-blue-500 text-blue-600 dark:text-blue-400 hover:text-white shrink-0 mt-0.5 transition-colors"
                    >
                      {isCur && playing ? (
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                      ) : (
                        <svg className="w-2.5 h-2.5 translate-x-px" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      )}
                    </button>
                  ) : (
                    <span className="w-6 h-6 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
                      <p className="text-sm font-semibold text-foreground leading-snug">{item.title}</p>
                    </a>
                    <p className="text-[11px] text-foreground/40 mt-0.5">
                      {item.source && <span className="text-blue-500/80 mr-1.5">{item.source}</span>}
                      {item.pubDate ? formatRelative(item.pubDate) : ""}
                    </p>
                    <p className="text-sm text-foreground/70 leading-relaxed mt-1">{item.summary}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <audio
        ref={audioRef}
        src={curItem?.audio ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={onEnded}
        // Reset progress driven by the <audio> element itself, not by a React
        // effect — the React 19 lint flags setState-in-effect, and the audio's
        // own loadstart is the right signal anyway (fires when src changes).
        onLoadStart={() => setCurrentClipTime(0)}
        onLoadedMetadata={() => curItem && recordDuration(curItem.url)}
        onTimeUpdate={() => setCurrentClipTime(audioRef.current?.currentTime ?? 0)}
        preload="none"
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
