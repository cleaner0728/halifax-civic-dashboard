"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 600;
const MOVE_TOLERANCE_PX = 10;

export default function BrandTitle() {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLHeadingElement>) => {
    startPosRef.current = { x: e.clientX, y: e.clientY };
    cancelLongPress();
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
      timerRef.current = null;
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLHeadingElement>) => {
    if (!startPosRef.current || timerRef.current == null) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) {
      cancelLongPress();
    }
  };

  // Tap outside to dismiss. Delayed by one tick so the long-press release
  // (pointerup) doesn't immediately close the popover that just opened.
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-brand-popover]")) {
        setOpen(false);
      }
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDocPointerDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDocPointerDown);
    };
  }, [open]);

  return (
    <div className="relative min-w-0">
      <h1
        data-scroll-top
        data-brand-popover
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        className="flex items-center gap-2 text-base font-bold tracking-tight cursor-pointer select-none [-webkit-touch-callout:none] min-w-0"
        title="Double-click to return to the top"
      >
        <Image
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="shrink-0"
          priority
          unoptimized
        />
        <span className="truncate">Made in Halifax</span>
      </h1>

      <div
        data-brand-popover
        role="dialog"
        aria-label="About this project"
        className={`absolute left-0 top-full mt-2 z-[80] flex items-start gap-2 rounded-xl bg-card/95 backdrop-blur border border-border shadow-lg px-3 py-2 text-sm text-foreground/80 transition-all duration-200 ${
          open
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-1 pointer-events-none"
        }`}
      >
        <span className="text-base leading-none mt-0.5" aria-hidden>🌱</span>
        <span className="leading-snug whitespace-nowrap">
          Produced by a Saint Mary&apos;s University MBA Student
          <br />
          <span className="text-foreground/55 whitespace-nowrap">ENTR 6677 Social and Sustainable Entrepreneurship</span>
        </span>
      </div>
    </div>
  );
}
