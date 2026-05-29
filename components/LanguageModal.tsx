"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconSearch, IconX } from "@/components/icons";

export type Language = { code: string; label: string; en?: string };

type Props = {
  open: boolean;
  languages: Language[];
  /** Currently active translation target, or null for English. */
  current: string | null;
  onClose: () => void;
  /** code = a target language, null = reset to English. */
  onSelect: (code: string | null) => void;
};

// Full-screen-friendly language picker. The old design crammed 24 languages
// into an expanding sub-list inside a small popover — no search, no sense of
// what was selected, and it pushed the other menu items around. This is a
// dedicated modal: searchable, current language clearly marked, and a roomy
// grid that's comfortable on both phone and desktop.
export default function LanguageModal({ open, languages, current, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search field on open and wire Escape to close. The modal is
  // mounted fresh each time it opens (parent gates on `open`), so `query`
  // starts empty without needing a reset here.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        (l.en?.toLowerCase().includes(q) ?? false),
    );
  }, [languages, query]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      data-no-tab-swipe
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel — bottom sheet on mobile, centered card on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose language"
        className="relative w-full sm:max-w-lg max-h-[80dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <h2 className="text-base font-semibold text-foreground">Language</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/8 transition-colors"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2">
            <IconSearch className="w-4 h-4 text-foreground/40 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search languages…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/40 outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto px-3 pb-4">
          <button
            onClick={() => onSelect(null)}
            className={`w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-1 flex items-center justify-between ${
              current === null
                ? "bg-blue-600 text-white"
                : "text-foreground hover:bg-foreground/5"
            }`}
          >
            English
            {current === null && <span className="text-xs">Current</span>}
          </button>
          <div className="grid grid-cols-2 gap-1">
            {filtered.map((lang) => {
              const active = current === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => onSelect(lang.code)}
                  className={`text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-blue-600 text-white font-medium"
                      : "text-foreground hover:bg-foreground/5"
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="text-center text-sm text-foreground/40 py-6">No match.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
