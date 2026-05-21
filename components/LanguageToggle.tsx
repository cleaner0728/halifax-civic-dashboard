"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";

// French is pinned to the top — Canada's other official language and the
// most likely "second look" target for any visitor. After that, grouped
// by region for predictability when the list is long. `code` is the
// language code Google Translate uses (matches its `tl=` / select-option
// values).
const LANGUAGES = [
  // Canada's other official language — top spot.
  { code: "fr", label: "Français" },
  // East Asian
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  // South / Southeast Asian
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "ta", label: "தமிழ்" },
  { code: "ur", label: "اردو" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tl", label: "Tagalog" },
  // Middle Eastern
  { code: "fa", label: "فارسی" },
  { code: "ar", label: "العربية" },
  { code: "he", label: "עברית" },
  // Slavic / Eastern European
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "pl", label: "Polski" },
  { code: "ro", label: "Română" },
  { code: "el", label: "Ελληνικά" },
  // Western European
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
];

// Why this isn't the obvious URL-redirect approach: this project is a
// Next.js 16 page where ~40% of the served HTML is the RSC streaming
// payload (`__next_f.push(...)`). Google's `*.translate.goog` proxy
// can't make sense of that and returns "Can't translate this page" for
// every target language, even Spanish/French/Chinese.
//
// The Google Translate Element widget is the workaround: it loads a
// Google script that translates the live DOM in-place, no proxy involved.
// The widget itself was deprecated in 2019 but Google still hosts it and
// it still works in 2026 — there's no API replacement.

const WIDGET_SCRIPT_ID = "gt-widget-script";
const WIDGET_ROOT_ID = "google_translate_element";
const COOKIE = "googtrans";

// Google's widget reads this cookie on init: presence of `/en/<target>`
// auto-applies the translation, including across page reloads. We set it
// against both the host and the registrable domain so subdomain hops
// (preview deploys, etc.) keep the translation sticky.
function setGoogTransCookie(target: string | null) {
  const host = window.location.hostname;
  const parts = host.split(".");
  const root = parts.length >= 2 ? parts.slice(-2).join(".") : host;
  const value = target ? `/en/${target}` : "";
  const expiry = target ? "" : "expires=Thu, 01 Jan 1970 00:00:00 GMT;";
  document.cookie = `${COOKIE}=${value};path=/;${expiry}`;
  document.cookie = `${COOKIE}=${value};path=/;domain=.${root};${expiry}`;
  // Also clear the bare-domain variant Google sometimes uses.
  document.cookie = `${COOKIE}=${value};path=/;domain=${root};${expiry}`;
}

// Returns a live <select> the widget renders once it's mounted. Until then,
// returns null — callers should retry or set the cookie + reload.
function widgetSelect(): HTMLSelectElement | null {
  return document.querySelector("select.goog-te-combo");
}

// Ensure the widget script is on the page. Idempotent.
function loadWidgetOnce() {
  if (document.getElementById(WIDGET_SCRIPT_ID)) return;

  // The widget script calls a global init function by the name we pass in
  // its `cb=` query param. Stashing a single, stable name keeps repeated
  // loadWidgetOnce() calls (StrictMode, hot reload) from clobbering each
  // other.
  type GTWindow = Window & {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement?: new (config: object, rootId: string) => unknown;
      };
    };
  };
  const w = window as GTWindow;
  w.googleTranslateElementInit = () => {
    const ctor = w.google?.translate?.TranslateElement;
    if (!ctor) return;
    new ctor({ pageLanguage: "en", autoDisplay: false }, WIDGET_ROOT_ID);
  };

  const s = document.createElement("script");
  s.id = WIDGET_SCRIPT_ID;
  s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  s.async = true;
  document.head.appendChild(s);
}

export default function LanguageToggle() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load the widget script once on first mount. Cheap if already loaded.
  useEffect(() => {
    loadWidgetOnce();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const translate = (target: string | null) => {
    // Persist across reloads via cookie; Google's script reads this on init.
    setGoogTransCookie(target);
    track("translate", { lang: target ?? "en-reset" });

    if (target === null) {
      // "Reset to English" → clearing the cookie alone doesn't revert the
      // already-translated DOM, so reload to start fresh.
      window.location.reload();
      return;
    }

    // Live update via the widget's hidden <select>. If the widget script
    // hasn't loaded yet, the cookie path will pick up after reload.
    const select = widgetSelect();
    if (select) {
      select.value = target;
      select.dispatchEvent(new Event("change"));
    } else {
      window.location.reload();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center
          bg-card border-2 border-border hover:border-foreground/30
          transition-all duration-300 shadow-sm hover:shadow-md"
        aria-label="Translate page"
        title="Translate page"
      >
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
          />
        </svg>
      </button>

      {/* Hidden host element for Google's widget. Position/visibility is
          enforced in globals.css so the inserted iframe + select never
          render visibly. The widget script writes into this element. */}
      <div id={WIDGET_ROOT_ID} aria-hidden />

      {open && (
        <ul
          role="menu"
          // max-h caps the dropdown to ~75% viewport height so the
          // 25+ entries don't run off-screen on shorter displays.
          className="absolute right-0 top-11 z-[80] w-44 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl py-1"
        >
          <li>
            <button
              onClick={() => {
                setOpen(false);
                translate(null);
              }}
              className="w-full text-left px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors border-b border-border"
            >
              English (reset)
            </button>
          </li>
          {LANGUAGES.map((lang) => (
            <li key={lang.code}>
              <button
                onClick={() => {
                  setOpen(false);
                  translate(lang.code);
                }}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-foreground/5 transition-colors"
              >
                {lang.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
