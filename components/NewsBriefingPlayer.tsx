"use client";

import { useRef, useState } from "react";
import { track } from "@vercel/analytics";

type Briefing = { hash: string; text: string; audio: string | null };
type Status = "idle" | "loading" | "ready" | "error";

function fmtTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function NewsBriefingPlayer() {
  const [status, setStatus] = useState<Status>("idle");
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [playing, setPlaying] = useState(false);
  const [showText, setShowText] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Lazy: nothing hits the API (and burns LLM/TTS quota) until the user asks.
  // Each load fetches the briefing for the CURRENT headlines — the server
  // regenerates summary + audio whenever the news changes, so this is always
  // in sync with what's on screen.
  const load = async () => {
    setStatus("loading");
    track("news_briefing_play");
    try {
      const res = await fetch("/api/news-briefing");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Briefing;
      if (!data.audio) throw new Error("no audio");
      setBriefing(data);
      setStatus("ready");
      requestAnimationFrame(() => void audioRef.current?.play());
    } catch (e) {
      console.error("[briefing] load failed", e);
      setStatus("error");
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * dur;
  };

  // ── idle / loading / error: a single pill button ──
  if (status !== "ready") {
    const isLoading = status === "loading";
    const isError = status === "error";
    return (
      <button
        onClick={isError ? () => setStatus("idle") : load}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 px-4 py-3 mb-4 transition-colors disabled:opacity-70"
      >
        {isLoading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Generating audio briefing…
            </span>
          </>
        ) : isError ? (
          <span className="text-sm font-medium text-foreground/50">
            Briefing unavailable · tap to retry
          </span>
        ) : (
          <>
            <span className="grid place-items-center w-7 h-7 rounded-full bg-blue-500 text-white shrink-0">
              <svg className="w-3.5 h-3.5 translate-x-px" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              Listen — AI news briefing
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-600 dark:text-blue-400">
              Beta
            </span>
          </>
        )}
      </button>
    );
  }

  // ── ready: compact custom player ──
  const pct = dur ? (cur / dur) * 100 : 0;
  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="grid place-items-center w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 text-white shrink-0 transition-colors"
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

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Halifax news briefing
            </span>
            <span className="text-[11px] tabular-nums text-foreground/40">
              {fmtTime(cur)} / {fmtTime(dur)}
            </span>
          </div>
          <div
            onClick={seek}
            className="h-1.5 rounded-full bg-foreground/10 cursor-pointer overflow-hidden"
          >
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2.5">
        <button
          onClick={() => setShowText((s) => !s)}
          className="text-[11px] font-medium text-foreground/45 hover:text-foreground/70 transition-colors"
        >
          {showText ? "Hide transcript" : "Show transcript"}
        </button>
        <span className="text-[10px] text-foreground/30">AI-generated from current headlines</span>
      </div>

      {showText && briefing?.text && (
        <p className="mt-2 text-sm leading-relaxed text-foreground/70 border-t border-border pt-2">
          {briefing.text}
        </p>
      )}

      <audio
        ref={audioRef}
        src={briefing?.audio ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
        hidden
      />
    </div>
  );
}
