"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ScrollSnapContainerProps {
  children: React.ReactNode[];
  labels: string[];
  topBar?: React.ReactNode;
}

export default function ScrollSnapContainer({ children, labels, topBar }: ScrollSnapContainerProps) {
  const router = useRouter();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [pullProgress, setPullProgress] = useState(0); // 0..1, drives the indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs that mirror state so touch/scroll handlers see live values without
  // having to re-attach their listeners on every render.
  const activeIndexRef = useRef(0);
  const sectionOffsetsRef = useRef<Record<number, number>>({});
  const isNavigatingRef = useRef(false);
  const navTimeoutRef = useRef<number | null>(null);

  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  // Auto-center the active tab pill in the (horizontally scrollable) tab bar.
  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex];
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeIndex]);

  // Whenever the active screen changes (tab click, swipe, or scroll-snap),
  // bring the header back. Otherwise its hidden state carries over to the
  // new screen and the user has to manually scroll up to re-summon it.
  useEffect(() => {
    setIsHeaderHidden(false);
  }, [activeIndex]);

  useEffect(() => {
    // root: null observes against the viewport (the document is the scroll
    // container now). rootMargin shrinks observation to a 1px band at the
    // viewport center, so exactly one section's midpoint can cross at a
    // time — no flicker between two ≥60%-visible sections.
    const observer = new IntersectionObserver(
      (entries) => {
        if (isNavigatingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-snap-section"));
            if (!isNaN(index)) setActiveIndex(index);
          }
        });
      },
      { root: null, rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    const sections = document.querySelectorAll("[data-snap-section]");
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Header hide/show driven by document scroll. window scroll (not a custom
  // div) so iOS Safari hands the scroll to its native UIScrollView for
  // best-in-class momentum.
  useEffect(() => {
    const HIDE_AFTER = 60;
    const SHOW_DELTA = 8;
    const BOTTOM_GUARD = 24;
    let lastScrollY = window.scrollY;
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollTop = window.scrollY;
      const delta = scrollTop - lastScrollY;
      const screenH = window.innerHeight;
      const snapPos = Math.round(scrollTop / screenH) * screenH;
      const withinScreen = scrollTop - snapPos;
      const maxScroll = document.documentElement.scrollHeight - screenH;
      const nearBottom = scrollTop >= maxScroll - BOTTOM_GUARD;
      if (delta > 0 && withinScreen > HIDE_AFTER) setIsHeaderHidden(true);
      else if (delta < -SHOW_DELTA && !nearBottom) setIsHeaderHidden(false);
      lastScrollY = scrollTop <= 0 ? 0 : scrollTop;
    };
    const onScroll = () => {
      // rAF-throttle so we don't fire setState 60+ times/sec during a flick.
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Programmatic tab navigation, used by pill clicks AND horizontal swipes.
  // Persists scroll-within-section per tab so switching away and back keeps
  // the user's reading position instead of dumping them at the top.
  const switchTo = useCallback((index: number) => {
    if (index < 0 || index >= children.length) return;
    const oldIdx = activeIndexRef.current;
    if (index === oldIdx) return;

    // Save where the user was inside the tab we're leaving, as an offset
    // from that tab's top. Storing relative-to-section (not absolute scrollY)
    // makes the saved position survive content height changes between
    // visits — e.g. the news list growing.
    const oldSection = document.querySelector(
      `[data-snap-section="${oldIdx}"]`,
    ) as HTMLElement | null;
    if (oldSection) {
      sectionOffsetsRef.current[oldIdx] = window.scrollY - oldSection.offsetTop;
    }

    const target = document.querySelector(
      `[data-snap-section="${index}"]`,
    ) as HTMLElement | null;
    if (!target) return;

    // Instant jump (not smooth): a smooth scroll across 6 screens would fire
    // the IO for every intermediate section and visibly cycle the active tab.
    isNavigatingRef.current = true;
    setActiveIndex(index);
    const savedOffset = sectionOffsetsRef.current[index] ?? 0;
    window.scrollTo({
      top: target.offsetTop + savedOffset,
      behavior: "instant" as ScrollBehavior,
    });
    if (navTimeoutRef.current) window.clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = window.setTimeout(() => {
      isNavigatingRef.current = false;
    }, 200);
  }, [children.length]);

  // Horizontal-swipe gesture → previous/next tab.
  //
  // Thresholds tuned to feel native: 80px minimum travel, must dominate the
  // vertical component by 2:1 (so vertical scrolling never accidentally
  // triggers a tab swap), and the gesture must complete within 500ms.
  // Touches that start inside `[data-no-tab-swipe]` are ignored so the
  // horizontally-scrollable tab bar and any future inline carousels keep
  // their own gestures.
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startT = 0;
    let armed = false;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-tab-swipe]")) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startT = Date.now();
      armed = true;
    };
    const onEnd = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startT;
      if (Math.abs(dx) < 80) return;
      if (Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dt > 500) return;
      const direction = dx < 0 ? 1 : -1; // swipe left → next tab
      switchTo(activeIndexRef.current + direction);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [switchTo]);

  // Custom pull-to-refresh. iOS Safari's built-in PTR reloads the whole
  // page (lossy + slow); we'd rather refetch only the server-component
  // data via router.refresh() while preserving client state. Native PTR
  // is suppressed via `overscroll-behavior-y: contain` in globals.css.
  const pullProgressRef = useRef(0);
  useEffect(() => {
    const THRESHOLD_PX = 80;
    const RATCHET = 2; // dy / 2 → user has to pull twice as far as the indicator moves
    let startY = 0;
    let pulling = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      // Only engage when we're at the very top — otherwise a normal scroll
      // gesture mid-page would accidentally fire the indicator.
      if (window.scrollY > 2) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy < 0) {
        // User reversed direction — abandon pull, let scroll take over.
        pulling = false;
        pullProgressRef.current = 0;
        setPullProgress(0);
        return;
      }
      const next = Math.min(1, dy / RATCHET / THRESHOLD_PX);
      pullProgressRef.current = next;
      setPullProgress(next);
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      const triggered = pullProgressRef.current >= 1;
      pullProgressRef.current = 0;
      setPullProgress(0);
      if (triggered) {
        setIsRefreshing(true);
        router.refresh();
        // router.refresh() is fire-and-forget for client code — we can't
        // await the RSC fetch. 800ms is enough for the spinner to register
        // as feedback without lingering past the actual refresh.
        window.setTimeout(() => setIsRefreshing(false), 800);
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);

  return (
    <>
      {/* Pull-to-refresh indicator — a small ring that fills as the user
          pulls down from the top, then spins while we wait on the RSC
          refresh. Sits below the fixed header so it's visible even with
          the header on-screen. */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[70] pointer-events-none transition-opacity duration-200"
        style={{ top: 96, opacity: pullProgress > 0 || isRefreshing ? 1 : 0 }}
        aria-hidden
      >
        <div className="rounded-full bg-card/90 backdrop-blur border border-border shadow-lg p-2.5">
          {isRefreshing ? (
            <span className="block w-5 h-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          ) : (
            <span
              className="block w-5 h-5 rounded-full border-2 border-foreground/30 border-t-foreground"
              style={{ transform: `rotate(${pullProgress * 360}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Header + Tabs — slide out together as one unit */}
      <div
        className={`fixed top-0 left-0 right-0 z-[60] transition-transform duration-300 ease-in-out ${
          isHeaderHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        {topBar && (
          <div
            className="relative z-10 bg-card/90 backdrop-blur-md border-b border-border"
            data-no-tab-swipe
          >
            {topBar}
          </div>
        )}
        <div className="bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
          <div
            // The tab bar scrolls horizontally on narrow screens; tag it so
            // dragging inside the bar pans the tabs instead of swapping tab.
            data-no-tab-swipe
            // Edge fade hint: the leftmost/rightmost ~12px softly fade out,
            // so on a narrow viewport where some tabs are cut off the bar
            // visibly hints "there's more — scroll horizontally." On wide
            // screens with no overflow the fade is barely visible.
            style={{
              maskImage:
                "linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, black 14px, black calc(100% - 14px), transparent 100%)",
            }}
            className="max-w-5xl mx-auto flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {labels.map((label, i) => (
              <button
                key={i}
                ref={(el) => { tabRefs.current[i] = el; }}
                onClick={() => switchTo(i)}
                // Active tab gets bolder weight + slightly larger pill
                // padding so the current location reads at a glance even
                // when you're scrolled deep inside a long section.
                className={`shrink-0 px-3.5 py-1.5 text-center text-sm whitespace-nowrap transition-all duration-200 border-b-2 ${
                  activeIndex === i
                    ? "border-blue-500 text-blue-500 bg-blue-500/5 dark:bg-blue-500/10 font-semibold"
                    : "border-transparent text-foreground/60 hover:text-foreground hover:bg-foreground/5 font-medium"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sections render directly in document flow — iOS hands body scroll
          to its native UIScrollView, the smoothest path. We deliberately
          do NOT use scroll-snap (not even `proximity`): on real iOS
          devices any snap config makes the OS soft-brake toward snap
          points and the inertia "fling" feels clipped. Sections won't
          perfectly align to the viewport top, but momentum wins. */}
      {children.map((child, i) => (
        <div
          key={i}
          data-snap-section={i}
          className="min-h-dvh"
        >
          {child}
        </div>
      ))}
    </>
  );
}
