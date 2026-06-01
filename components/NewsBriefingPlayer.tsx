"use client";

import { useRef, useState, useEffect } from "react";
import { track } from "@vercel/analytics";
import { formatRelative } from "@/lib/date";
import BetaOnly from "@/components/BetaOnly";

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

  // When the current index changes (e.g. a clip ended → next), play it.
  useEffect(() => {
    if (current < 0) return;
    if (autoplay.current) requestAnimationFrame(() => void audioRef.current?.play());
  }, [current]);

  const playable = items.filter((i) => i.audio);

  // ── Load audio collection + start playing from the top ──
  const listen = async () => {
    track("news_briefing_play");
    if (items.some((i) => i.audio)) {
      // already loaded with audio — just (re)start
      startPlaylist();
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/news-briefing");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: Item[] };
      if (!data.items?.length) throw new Error("empty");
      setItems(data.items);
      setListOpen(true);
      setStatus("ready");
      autoplay.current = true;
      const first = data.items.findIndex((i) => i.audio);
      setCurrent(first); // effect plays it
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
    else { autoplay.current = false; setPlaying(false); }
  };

  const loading = status === "loading";
  const curItem = current >= 0 ? items[current] : null;

  return (
    <div className="mb-4 space-y-2">
      {/* ── Buttons ── */}
      <div className="flex gap-2">
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
        <div className="flex items-center gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-2">
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
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-foreground/40">
              Now playing · {playable.findIndex((p) => p.url === curItem.url) + 1} of {playable.length}
            </p>
            <p className="text-sm font-medium text-foreground truncate">{curItem.title}</p>
          </div>
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
        preload="none"
        hidden
      />
    </div>
  );
}
