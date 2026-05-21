"use client";

import { useEffect, useRef, useState } from "react";

// Languages exposed in the dropdown. `code` is the ISO code Google Translate
// expects in tl=. Add/reorder as you wish — UI auto-adapts.
// French is pinned to the top — Canada's other official language and the
// most likely "second look" target for any visitor. After that, grouped
// by region for predictability when the list is long. `code` is the
// value Google Translate expects in tl=.
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

export default function LanguageToggle() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const translate = (target: string) => {
    // Use Google's modern `*.translate.goog` subdomain proxy directly. The
    // legacy `translate.google.com/translate?u=…` form has been quietly
    // pulled back for less-common targets — pages render but Google shows
    // "Can't translate this page" for languages like Tamil, Persian,
    // Gujarati, etc. The .goog form supports the full Translate catalog.
    //
    // Hostname-to-subdomain transform: dots and colons in the host become
    // dashes, e.g. `news.halifax.ca` → `news-halifax-ca.translate.goog`.
    // Same-tab navigation keeps iOS-standalone PWAs inside the app shell.
    const proxiedHost = window.location.host.replace(/[.:]/g, '-');
    const url = `https://${proxiedHost}.translate.goog${window.location.pathname}?_x_tr_sl=auto&_x_tr_tl=${encodeURIComponent(target)}&_x_tr_hl=en`;
    window.location.href = url;
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

      {open && (
        <ul
          role="menu"
          // max-h caps the dropdown to ~75% viewport height so 26 entries
          // don't run off-screen on shorter displays; vertical scroll
          // appears automatically when the content exceeds the cap.
          className="absolute right-0 top-11 z-[80] w-44 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl py-1"
        >
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
