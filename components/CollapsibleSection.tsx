"use client";

import { useAccordion } from "@/components/AccordionGroup";

type Props = {
  id: string;
  icon: React.ReactNode;
  title: string;
  meta?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
};

export default function CollapsibleSection({
  id,
  icon,
  title,
  meta,
  href,
  linkLabel,
  children,
}: Props) {
  const { openId, toggle } = useAccordion();
  const isOpen = openId === id;

  return (
    <div className="mt-8">
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
