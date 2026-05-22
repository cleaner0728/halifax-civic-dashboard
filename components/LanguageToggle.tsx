"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@vercel/analytics";

// French is pinned to the top — Canada's other official language. Below
// that, ordered by geographic longitude east → west across Eurasia and
// the Mediterranean, with north-to-south breaking near-ties. `code`
// matches Google Translate's `tl=` / select-option values.
const LANGUAGES = [
  { code: "fr", label: "Français" },
  // East Asia / Pacific
  { code: "ja", label: "日本語" },        // Japan ~140°E
  { code: "ko", label: "한국어" },        // Korea ~127°E
  { code: "zh-TW", label: "中文 (繁體)" }, // Taiwan ~121°E
  { code: "tl", label: "Tagalog" },      // Philippines ~121°E (south of Taiwan)
  { code: "zh-CN", label: "中文 (简体)" }, // Mainland China ~115°E
  { code: "vi", label: "Tiếng Việt" },    // Vietnam ~106°E
  // South Asia
  { code: "bn", label: "বাংলা" },         // Bangladesh ~90°E
  { code: "ta", label: "தமிழ்" },         // Tamil Nadu ~80°E
  { code: "hi", label: "हिन्दी" },        // North India ~77°E
  { code: "pa", label: "ਪੰਜਾਬੀ" },         // Punjab ~75°E
  { code: "gu", label: "ગુજરાતી" },       // Gujarat ~73°E
  { code: "ur", label: "اردو" },          // Pakistan ~67°E
  // West Asia / Middle East
  { code: "fa", label: "فارسی" },         // Iran ~53°E
  { code: "ar", label: "العربية" },       // Arabian peninsula ~45°E
  { code: "ru", label: "Русский" },       // Russia (Moscow) ~37°E
  { code: "he", label: "עברית" },         // Israel ~35°E
  // Eastern Europe
  { code: "uk", label: "Українська" },    // Ukraine ~30°E
  { code: "ro", label: "Română" },        // Romania ~25°E
  { code: "el", label: "Ελληνικά" },      // Greece ~24°E
  { code: "pl", label: "Polski" },        // Poland ~21°E
  // Western Europe
  { code: "it", label: "Italiano" },      // Italy ~12°E
  { code: "de", label: "Deutsch" },       // Germany ~10°E
  { code: "es", label: "Español" },       // Spain ~−4°E
  { code: "pt", label: "Português" },     // Portugal ~−9°E
];

const COOKIE = "googtrans";

// Google's widget reads this cookie on init: presence of `/en/<target>`
// auto-applies the translation across page reloads. Set against both
// host and registrable domain so subdomain hops stay sticky.
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

// The widget script + hidden root live in layout via <GoogleTranslateMount/>,
// so this component only handles cookie + select dispatch.
export default function LanguageToggle() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const translate = (target: string | null) => {
    setGoogTransCookie(target);
    track("translate", { lang: target ?? "en-reset" });

    if (target === null) {
      // Clearing the cookie alone doesn't revert the already-translated DOM,
      // so reload to start fresh.
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center
          bg-card border-2 border-border hover:border-foreground/30
          transition-all duration-300 shadow-sm hover:shadow-md"
        aria-label="Translate page"
        title="Translate page"
        aria-expanded={open}
        aria-haspopup="menu"
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
          className="absolute right-0 top-11 z-[80] w-44 max-h-[75vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl py-1"
        >
          <li>
            <button
              onClick={() => {
                setOpen(false);
                translate(null);
              }}
              role="menuitem"
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
                role="menuitem"
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
