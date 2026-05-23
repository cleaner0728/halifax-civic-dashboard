"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { track } from "@vercel/analytics";
import FeedbackModal from "@/components/FeedbackModal";

const SHARE_TITLE = "Made in Halifax";
const SHARE_TEXT = "Live news, weather, and transit for Halifax, NS.";

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isDark = mounted && resolvedTheme === "dark";

  const onShare = async () => {
    setOpen(false);
    const url = typeof window !== "undefined" ? window.location.origin + "/" : "";
    track("share");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
        return;
      } catch {
        // User cancelled or share unsupported for this payload — fall through
        // to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (insecure context, permissions) — nothing useful
      // we can do silently; user can still copy the address bar manually.
    }
  };

  const onFeedback = () => {
    setOpen(false);
    track("feedback_open");
    setFeedbackOpen(true);
  };

  return (
    <>
    <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center
          bg-card border-2 border-border hover:border-foreground/30
          transition-all duration-300 shadow-sm hover:shadow-md"
        aria-label="Settings"
        title="Settings"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg
          className="w-5 h-5 text-foreground/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-[80] w-48 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
        >
          <button
            onClick={() => { if (!mounted) return; setTheme(isDark ? 'light' : 'dark'); setOpen(false); }}
            role="menuitem"
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span>{isDark ? "Dark mode" : "Light mode"}</span>
            <span className="relative w-5 h-5">
              <svg
                className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                  isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 text-amber-500"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <svg
                className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                  isDark ? "opacity-100 text-blue-400" : "opacity-0 -rotate-90 scale-50"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </span>
          </button>

          <div className="border-t border-border" />

          <button
            onClick={onShare}
            role="menuitem"
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
          >
            <span>Share</span>
            <svg
              className="w-5 h-5 text-sky-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </button>

          <button
            onClick={onFeedback}
            role="menuitem"
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
          >
            <span>Feedback</span>
            <svg
              className="w-5 h-5 text-emerald-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
    </>
  );
}
