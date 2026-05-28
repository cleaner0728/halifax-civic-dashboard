"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { formatRelative } from "@/lib/date";

// Footer that closes out the last tab (Civic Calendar). Two scroll-back
// affordances + a closure line so users know they've reached the end.
//
// "Back to Events" reuses the same idiom as the floating button on every
// other tab — pill with up-chevron, low-contrast. "Top" is the dedicated
// long-distance trip back to Weather; double-chevron icon and identical
// neutral styling so neither button dominates.
//
// `renderedAt` is the wall-clock time (ms) at which the parent server
// component last produced this page payload — RSC cache hits will reuse
// the same value, so a stale page genuinely shows the older timestamp.
// Re-ticked every 30s on the client so the "Xm ago" string stays fresh
// even when the user lingers without refreshing.
export default function EndOfDashboardFooter({ renderedAt }: { renderedAt: number }) {
  // Re-render every 30s so the "Xm ago" label recomputes against the current
  // clock (formatRelative reads Date.now() each call). A bare tick counter
  // avoids storing a Date.now() value in state and the set-state-in-effect
  // lint rule — the interval setter runs in a callback, not synchronously.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const ageLabel = formatRelative(renderedAt) || "just now";

  const scrollToSectionTop = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Walk up to the enclosing <section data-snap-section="…"> rather than
    // hard-coding the index, so this stays correct if Civic Cal is ever
    // reordered or this footer is reused on a different tab.
    const section = e.currentTarget.closest("[data-snap-section]") as HTMLElement | null;
    if (section) window.scrollTo({ top: section.offsetTop, behavior: "smooth" });
    track("footer_back_to_section");
  };

  const scrollToPageTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    track("footer_back_to_top");
  };

  const buttonClass =
    "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium " +
    "bg-foreground/6 border border-foreground/10 " +
    "text-foreground/45 hover:text-foreground/75 hover:bg-foreground/10 " +
    "transition-all duration-200 backdrop-blur-sm";

  return (
    <div className="flex flex-col items-center gap-4 pt-10 pb-12">
      <div className="flex items-center gap-2">
        <button
          onClick={scrollToSectionTop}
          aria-label="Back to top of Events"
          className={buttonClass}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
          <span>Events</span>
        </button>
        <button
          onClick={scrollToPageTop}
          aria-label="Back to top of dashboard"
          className={buttonClass}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
          </svg>
          <span>Top</span>
        </button>
      </div>
      <div className="text-center space-y-1 px-4">
        <p className="text-sm text-foreground/55 italic">
          All quiet on the Atlantic front… for now.
        </p>
        <p className="text-xs text-foreground/35">
          7 sources · refreshed {ageLabel} · pull down to refresh
        </p>
      </div>
    </div>
  );
}
