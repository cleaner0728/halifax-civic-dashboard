"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { track } from "@vercel/analytics";
import FeedbackModal from "@/components/FeedbackModal";

// French first (Canada's other official language); rest ordered roughly
// east → west by region. `code` matches Google Translate's `tl=` values.
const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "tl", label: "Tagalog" },
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "bn", label: "বাংলা" },
  { code: "ta", label: "தமிழ்" },
  { code: "hi", label: "हिन्दी" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "ur", label: "اردو" },
  { code: "fa", label: "فارسی" },
  { code: "ar", label: "العربية" },
  { code: "ru", label: "Русский" },
  { code: "he", label: "עברית" },
  { code: "uk", label: "Українська" },
  { code: "ro", label: "Română" },
  { code: "el", label: "Ελληνικά" },
  { code: "pl", label: "Polski" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
];

const COOKIE = "googtrans";
const SHARE_TITLE = "Made in Halifax";
const SHARE_TEXT = "Live news, weather, and transit for Halifax, NS.";

// Google Translate widget reads this cookie on init; the `/en/<target>`
// shape is its sentinel for "translate from English to <target>". Set
// against both the exact host and the registrable domain so subdomain
// hops stay sticky.
function setGoogTransCookie(target: string | null) {
  const host = window.location.hostname;
  const parts = host.split(".");
  const root = parts.length >= 2 ? parts.slice(-2).join(".") : host;
  const value = target ? `/en/${target}` : "";
  const expiry = target ? "" : "expires=Thu, 01 Jan 1970 00:00:00 GMT;";
  document.cookie = `${COOKIE}=${value};path=/;${expiry}`;
  document.cookie = `${COOKIE}=${value};path=/;domain=.${root};${expiry}`;
  document.cookie = `${COOKIE}=${value};path=/;domain=${root};${expiry}`;
}

function widgetSelect(): HTMLSelectElement | null {
  return document.querySelector("select.goog-te-combo");
}

export default function MenuFab() {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  // Standard next-themes pattern: resolvedTheme is undefined until client
  // mount, so we gate any theme-dependent UI on `mounted`. The lint rule
  // complains about setState inside an effect, but here that's exactly
  // what we need — the only signal that hydration is complete.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

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

  const translate = (target: string | null) => {
    setGoogTransCookie(target);
    track("translate", { lang: target ?? "en-reset" });
    setOpen(false);
    if (target === null) {
      window.location.reload();
      return;
    }
    const select = widgetSelect();
    if (select) {
      select.value = target;
      select.dispatchEvent(new Event("change"));
    } else {
      window.location.reload();
    }
  };

  const onShare = async () => {
    setOpen(false);
    const url = typeof window !== "undefined" ? window.location.origin + "/" : "";
    track("share");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
        return;
      } catch {
        // user cancelled or share unsupported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard blocked (insecure context / permission) — nothing useful to do silently
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
      <div
        ref={ref}
        // FAB lives outside any scrolling section so it's always reachable.
        // On mobile it sits ABOVE the bottom tab bar (~64px tall + safe-area).
        // On desktop the bottom is free of nav, so a smaller offset is fine.
        className="fixed right-4 z-[65]"
        // Tab bar is ~98px tall once py-3.5 + 3xl icon + xs label + gap
        // settle (measured live, not estimated). 120px puts the FAB ~22px
        // above the bar's top edge — enough breathing room not to read
        // as part of it.
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 120px)",
        }}
        data-menu-fab
      >
        {/* Desktop override: nav doesn't sit on the bottom, so drop the
            FAB closer to the edge. Tailwind doesn't let us mix arbitrary
            calc() in `md:` easily, so apply a transform offset instead. */}
        <style>{`
          @media (min-width: 768px) {
            [data-menu-fab] { bottom: 1.25rem !important; }
          }
        `}</style>

        {open && (
          <div
            role="menu"
            // Anchors to the FAB; opens upward + slightly to the left so the
            // panel stays on-screen on narrow viewports.
            className="absolute bottom-14 right-0 w-64 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            data-no-tab-swipe
          >
            <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
              Settings
            </div>
            <button
              onClick={() => { if (!mounted) return; setTheme(isDark ? "light" : "dark"); setOpen(false); }}
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </span>
            </button>
            <button
              onClick={onShare}
              role="menuitem"
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
            >
              <span>Share</span>
              <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              onClick={onFeedback}
              role="menuitem"
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
            >
              <span>Feedback</span>
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>

            <div className="border-t border-border mt-1" />
            <button
              onClick={() => setLangOpen((v) => !v)}
              aria-expanded={langOpen}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                Language
              </span>
              <svg
                className={`w-4 h-4 text-foreground/50 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {langOpen && (
              <>
                <button
                  onClick={() => translate(null)}
                  role="menuitem"
                  className="w-full text-left px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors border-t border-border"
                >
                  English (reset)
                </button>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => translate(lang.code)}
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    {lang.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        <button
          onClick={() => {
            // Reset the language sub-section to collapsed every time the
            // menu opens — long list shouldn't dominate the panel just
            // because the user expanded it on a previous open.
            setOpen((o) => {
              if (!o) setLangOpen(false);
              return !o;
            });
          }}
          aria-label="Open menu"
          aria-expanded={open}
          aria-haspopup="menu"
          // 50% translucent so the FAB doesn't dominate the corner;
          // backdrop-blur keeps it legible over busy content underneath.
          className="w-12 h-12 rounded-full flex items-center justify-center
            bg-card/50 backdrop-blur border-2 border-border hover:border-foreground/30
            shadow-lg hover:shadow-xl transition-all duration-200
            active:scale-95"
        >
          <svg
            className={`w-6 h-6 text-foreground/80 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
    </>
  );
}
