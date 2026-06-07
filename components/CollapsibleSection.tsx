"use client";

import { useRef, useEffect } from "react";
import { useAccordion } from "@/components/AccordionGroup";

type Props = {
  id: string;
  icon: React.ReactNode;
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
  /** Show a subtle "New" hint in the collapsed header — set when the feed has
   *  content first seen today. Hidden once the section is opened. */
  hasUpdate?: boolean;
  children: React.ReactNode;
};

export default function CollapsibleSection({
  id,
  icon,
  title,
  meta,
  href,
  linkLabel,
  hasUpdate,
  children,
}: Props) {
  const { openId, toggle } = useAccordion();
  const isOpen = openId === id;
  const ref = useRef<HTMLDivElement>(null);

  // When this section opens, scroll its header to just below the fixed top bar.
  useEffect(() => {
    if (!isOpen || !ref.current) return;
    // One frame delay so the previous section's panel has collapsed and the
    // DOM heights have settled before we calculate scroll position.
    const raf = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen]);

  return (
    <div ref={ref} className="mt-8" style={{ scrollMarginTop: "5rem" }}>
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 mb-3 px-1 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-foreground/55 shrink-0">{icon}</span>
          <h2 className="text-lg font-bold text-foreground truncate">{title}</h2>
          {meta && (
            <span className="text-xs text-foreground/40 truncate">· {meta}</span>
          )}
          {hasUpdate && !isOpen && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[11px] font-semibold px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" aria-hidden />
              New
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-foreground/50 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="space-y-3 animate-in slide-in-from-top-1 duration-150">
          {children}
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-foreground/50 hover:text-foreground/80 px-1"
            >
              {linkLabel ?? "source"} ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
