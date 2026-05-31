"use client";

import { useRef, useState } from "react";
import { track } from "@vercel/analytics";

type Briefing = { hash: string; text: string; audio: string | null };
type AudioStatus = "idle" | "loading" | "ready" | "error";
type TextStatus  = "idle" | "loading" | "ready" | "error";

function fmtTime(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function NewsBriefingPlayer() {
  // ── audio state ──
  const [audioStatus, setAudioStatus] = useState<AudioStatus>("idle");
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // ── text-summary state ──
  const [textStatus, setTextStatus] = useState<TextStatus>("idle");
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // ── load audio (lazy) ──
  const loadAudio = async () => {
    setAudioStatus("loading");
    track("news_briefing_play");
    try {
      const res = await fetch("/api/news-briefing");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Briefing;
      if (!data.audio) throw new Error("no audio");
      setBriefing(data);
      setSummaryText(data.text); // reuse text that came with audio
      setTextStatus("ready");
      setAudioStatus("ready");
      requestAnimationFrame(() => void audioRef.current?.play());
    } catch (e) {
      console.error("[briefing] audio load failed", e);
      setAudioStatus("error");
    }
  };

  // ── load text only (no TTS cost, faster) ──
  const loadText = async () => {
    // If audio already loaded, we already have the text.
    if (summaryText) { setShowSummary(s => !s); return; }
    setTextStatus("loading");
    track("news_briefing_read");
    try {
      const res = await fetch("/api/news-briefing?mode=text");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { text: string };
      setSummaryText(data.text);
      setTextStatus("ready");
      setShowSummary(true);
    } catch (e) {
      console.error("[briefing] text load failed", e);
      setTextStatus("error");
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

  const pct = dur ? (cur / dur) * 100 : 0;

  return (
    <div className="mb-4 space-y-2">

      {/* ── Top row: Listen + Read buttons ── */}
      <div className="flex gap-2">

        {/* Listen button / player */}
        {audioStatus === "idle" || audioStatus === "error" ? (
          <button
            onClick={audioStatus === "error" ? () => setAudioStatus("idle") : loadAudio}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              audioStatus === "error"
                ? "border-border text-foreground/40 hover:text-foreground/60"
                : "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400"
            }`}
          >
            {audioStatus === "error" ? (
              "Audio unavailable · retry"
            ) : (
              <>
                <span className="grid place-items-center w-6 h-6 rounded-full bg-blue-500 text-white shrink-0">
                  <svg className="w-3 h-3 translate-x-px" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                Listen — AI briefing
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/15">
                  Beta
                </span>
              </>
            )}
          </button>
        ) : audioStatus === "loading" ? (
          <div className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-2.5">
            <span className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <span className="text-sm text-blue-600 dark:text-blue-400">Generating audio…</span>
          </div>
        ) : (
          /* Compact inline player */
          <div className="flex-1 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-2">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="grid place-items-center w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white shrink-0 transition-colors"
            >
              {playing ? (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 translate-x-px" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div
                onClick={seek}
                className="h-1.5 rounded-full bg-foreground/10 cursor-pointer overflow-hidden"
              >
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="text-[11px] tabular-nums text-foreground/40 shrink-0">
              {fmtTime(cur)}/{fmtTime(dur)}
            </span>
          </div>
        )}

        {/* Read summary button */}
        <button
          onClick={loadText}
          disabled={textStatus === "loading"}
          aria-label="Read AI summary"
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors shrink-0 ${
            showSummary && textStatus === "ready"
              ? "border-foreground/20 bg-foreground/8 text-foreground/70"
              : "border-border hover:border-foreground/20 text-foreground/50 hover:text-foreground/70"
          } disabled:opacity-50`}
        >
          {textStatus === "loading" ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-foreground/20 border-t-foreground/60 animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <span className="hidden sm:inline">
            {textStatus === "error" ? "Retry" : "Read"}
          </span>
        </button>

      </div>

      {/* ── Expandable summary text ── */}
      {showSummary && summaryText && (
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/35">
              AI-generated summary · based on full article text
            </p>
            <button
              onClick={() => setShowSummary(false)}
              className="text-foreground/30 hover:text-foreground/60 transition-colors"
              aria-label="Close summary"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm leading-relaxed text-foreground/75">{summaryText}</p>
        </div>
      )}

      {/* Hidden audio element */}
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
