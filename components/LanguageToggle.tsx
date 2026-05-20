"use client";

import { useEffect, useRef, useState } from "react";

// Languages exposed in the dropdown. `code` is the ISO code Google Translate
// expects in tl=. Add/reorder as you wish — UI auto-adapts.
const LANGUAGES = [
  { code: "zh-CN", label: "中文 (简体)" },
  { code: "zh-TW", label: "中文 (繁體)" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "ar", label: "العربية" },
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
    // Older Google Translate proxy URL — still works in 2026 and redirects to
    // the *.translate.goog subdomain. Same-tab navigation so iOS standalone
    // PWAs keep the user inside the app (instead of bouncing to Safari).
    const here = window.location.origin + window.location.pathname;
    const url = `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(target)}&u=${encodeURIComponent(here)}`;
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
          className="absolute right-0 top-11 z-[80] w-44 rounded-xl border border-border bg-card shadow-xl py-1 overflow-hidden"
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
