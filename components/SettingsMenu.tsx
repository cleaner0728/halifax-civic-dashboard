"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { track } from "@vercel/analytics";
import FeedbackModal from "@/components/FeedbackModal";
import LanguageModal, { type Language } from "@/components/LanguageModal";
import { IconSettings, IconGlobe, IconMail } from "@/components/icons";

// French first (Canada's other official language); rest ordered roughly
// east → west by region. `code` matches Google Translate's `tl=` values.
const LANGUAGES: Language[] = [
  { code: "fr", label: "Français", en: "French" },
  { code: "ja", label: "日本語", en: "Japanese" },
  { code: "ko", label: "한국어", en: "Korean" },
  { code: "zh-TW", label: "中文 (繁體)", en: "Chinese Traditional" },
  { code: "tl", label: "Tagalog", en: "Tagalog Filipino" },
  { code: "zh-CN", label: "中文 (简体)", en: "Chinese Simplified" },
  { code: "vi", label: "Tiếng Việt", en: "Vietnamese" },
  { code: "bn", label: "বাংলা", en: "Bengali" },
  { code: "ta", label: "தமிழ்", en: "Tamil" },
  { code: "hi", label: "हिन्दी", en: "Hindi" },
  { code: "pa", label: "ਪੰਜਾਬੀ", en: "Punjabi" },
  { code: "gu", label: "ગુજરાતી", en: "Gujarati" },
  { code: "ur", label: "اردو", en: "Urdu" },
  { code: "fa", label: "فارسی", en: "Persian Farsi" },
  { code: "ar", label: "العربية", en: "Arabic" },
  { code: "ru", label: "Русский", en: "Russian" },
  { code: "he", label: "עברית", en: "Hebrew" },
  { code: "uk", label: "Українська", en: "Ukrainian" },
  { code: "ro", label: "Română", en: "Romanian" },
  { code: "el", label: "Ελληνικά", en: "Greek" },
  { code: "pl", label: "Polski", en: "Polish" },
  { code: "it", label: "Italiano", en: "Italian" },
  { code: "de", label: "Deutsch", en: "German" },
  { code: "es", label: "Español", en: "Spanish" },
  { code: "pt", label: "Português", en: "Portuguese" },
];

const COOKIE = "googtrans";
const SHARE_TITLE = "Made in Halifax";
const SHARE_TEXT = "Live news, weather, and transit for Halifax, NS.";

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

function readGoogTransCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function widgetSelect(): HTMLSelectElement | null {
  return document.querySelector("select.goog-te-combo");
}

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentLang, setCurrentLang] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { resolvedTheme, setTheme } = useTheme();

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); setCurrentLang(readGoogTransCookie()); }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
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
    setLangOpen(false);
    setOpen(false);
    if (target === null) {
      window.location.reload();
      return;
    }
    const select = widgetSelect();
    if (select) {
      select.value = target;
      select.dispatchEvent(new Event("change"));
      setCurrentLang(target);
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
        // user cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard blocked — nothing useful to do silently
    }
  };

  const onFeedback = () => {
    setOpen(false);
    track("feedback_open");
    setFeedbackOpen(true);
  };

  const itemClass =
    "w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors";

  return (
    <div ref={ref} className="relative shrink-0">
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      {langOpen && (
        <LanguageModal
          open
          languages={LANGUAGES}
          current={currentLang}
          onClose={() => setLangOpen(false)}
          onSelect={translate}
        />
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-9 h-9 rounded-full flex items-center justify-center
          bg-card border-2 border-border hover:border-foreground/30
          transition-all duration-300 shadow-sm hover:shadow-md active:scale-95"
      >
        <IconSettings className={`w-5 h-5 text-foreground/80 transition-transform duration-300 ${open ? "rotate-45" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-2 w-60 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-[80]"
          data-no-tab-swipe
        >
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/40">
            Settings
          </div>

          <button
            onClick={() => { if (!mounted) return; setTheme(isDark ? "light" : "dark"); setOpen(false); }}
            role="menuitem"
            className={itemClass}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span>{isDark ? "Dark mode" : "Light mode"}</span>
            <span className="relative w-5 h-5">
              <svg className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 text-amber-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <svg className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${isDark ? "opacity-100 text-blue-400" : "opacity-0 -rotate-90 scale-50"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </span>
          </button>

          <button onClick={onShare} role="menuitem" className={itemClass}>
            <span>Share</span>
            <svg className="w-5 h-5 text-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>

          <button onClick={onFeedback} role="menuitem" className={itemClass}>
            <span>Feedback</span>
            <IconMail className="w-5 h-5 text-foreground/50" />
          </button>

          <div className="border-t border-border" />

          <button
            onClick={() => { setOpen(false); setLangOpen(true); }}
            role="menuitem"
            className={itemClass}
          >
            <span className="flex items-center gap-2">
              <IconGlobe className="w-4 h-4 text-foreground/50" />
              Language
            </span>
            <span className="text-xs text-foreground/40">
              {currentLang ? (LANGUAGES.find((l) => l.code === currentLang)?.label ?? currentLang) : "English"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
