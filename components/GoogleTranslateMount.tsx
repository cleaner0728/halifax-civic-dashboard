"use client";

import { useEffect } from "react";

// Hosts Google's hidden Translate widget at the document level so menu
// components that drive translation can mount/unmount freely without
// tearing down the widget. The widget script writes into a global root
// element by id, so this element must outlive any consumer UI.
//
// Why the widget at all (rather than the obvious `*.translate.goog`
// proxy): this is a Next.js 16 page where ~40% of the served HTML is
// RSC streaming payload (`__next_f.push(...)`). Google's proxy can't
// parse that and returns "Can't translate this page" for every target.
// The widget translates the live DOM in-place, no proxy involved. It
// was deprecated in 2019 but Google still hosts it and it still works
// in 2026 — there's no API replacement.

const WIDGET_SCRIPT_ID = "gt-widget-script";
export const WIDGET_ROOT_ID = "google_translate_element";

export default function GoogleTranslateMount() {
  useEffect(() => {
    if (document.getElementById(WIDGET_SCRIPT_ID)) return;

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
  }, []);

  // Position/visibility enforced in globals.css so the inserted iframe +
  // select never render visibly. The widget script writes into this div.
  return <div id={WIDGET_ROOT_ID} aria-hidden />;
}
