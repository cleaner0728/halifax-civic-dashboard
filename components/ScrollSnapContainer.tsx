"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";

interface ScrollSnapContainerProps {
  children: React.ReactNode[];
  labels: string[];
  topBar?: React.ReactNode;
}

export default function ScrollSnapContainer({ children, labels, topBar }: ScrollSnapContainerProps) {
  const router = useRouter();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [headerOpacity, setHeaderOpacity] = useState(1);
  const [pullProgress, setPullProgress] = useState(0); // 0..1, drives the indicator
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs that mirror state so touch/scroll handlers see live values without
  // having to re-attach their listeners on every render.
  const activeIndexRef = useRef(0);
  const sectionOffsetsRef = useRef<Record<number, number>>({});
  const isNavigatingRef = useRef(false);
  const navTimeoutRef = useRef<number | null>(null);

  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  // Tab dwell-time analytics. When activeIndex changes, emit a `tab_view`
  // event for the OUTGOING tab with how long the user spent on it.
  // Threshold of 1.5s filters out drive-by passes during snap-scrolling
  // or fast horizontal swipes so the data reflects actual reading time.
  const tabEnterRef = useRef<{ tab: string; at: number }>({ tab: labels[0], at: Date.now() });
  useEffect(() => {
    const prev = tabEnterRef.current;
    const elapsedMs = Date.now() - prev.at;
    if (elapsedMs >= 1500 && prev.tab !== labels[activeIndex]) {
      track("tab_view", { tab: prev.tab, seconds: Math.round(elapsedMs / 1000) });
    }
    tabEnterRef.current = { tab: labels[activeIndex], at: Date.now() };
  }, [activeIndex, labels]);

  // Auto-center the active tab pill in the (horizontally scrollable) tab bar.
  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex];
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
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

  // After a fling settles, if the user landed within EDGE_BAND of a section
  // boundary, smooth-scroll the rest of the way so the card tops align to
  // the viewport. Mid-section is a dead zone — we don't yank users away
  // from content they may be reading. Done in JS rather than CSS
  // scroll-snap because every CSS snap-type kills iOS WebKit's inertia.
  useEffect(() => {
    const EDGE_BAND = 80;
    let timer = 0;
    let touching = false;

    const snapIfNeeded = () => {
      if (touching) return;
      if (isNavigatingRef.current) return;
      const scrollTop = window.scrollY;
      const screenH = window.innerHeight;
      const snapPos = Math.round(scrollTop / screenH) * screenH;
      const withinScreen = scrollTop - snapPos;

      let target: number | null = null;
      if (withinScreen > 0 && withinScreen < EDGE_BAND) {
        target = snapPos;
      } else if (withinScreen > screenH - EDGE_BAND) {
        target = snapPos + screenH;
      }
      if (target == null) return;

      const maxScroll = document.documentElement.scrollHeight - screenH;
      target = Math.max(0, Math.min(maxScroll, target));
      if (Math.abs(target - scrollTop) < 1) return;

      window.scrollTo({ top: target, behavior: "smooth" });
    };

    const onScroll = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(snapIfNeeded, 150);
    };
    const onTouchStart = () => { touching = true; };
    const onTouchEnd = () => {
      touching = false;
      // After release, give the momentum fling a beat to start, then re-arm.
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(snapIfNeeded, 250);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Header opacity tied directly to scroll position within the current
  // snap section — no direction detection. Scrolling down fades it out
  // gradually; scrolling back toward the top fades it back in.
  useEffect(() => {
    const FADE_RANGE = 160;
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollTop = window.scrollY;
      const screenH = window.innerHeight;
      const snapPos = Math.round(scrollTop / screenH) * screenH;
      const withinScreen = Math.max(0, scrollTop - snapPos);
      setHeaderOpacity(Math.max(0, Math.min(1, 1 - withinScreen / FADE_RANGE)));
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

  // iOS "tap the status bar" classic — double-click anywhere on the fixed
  // header (that isn't a button/link) and we'll smooth-scroll back to the
  // first tab's top. Filter out double-clicks on interactive children so
  // a quick double-tap on a tab pill doesn't also trigger this.
  const onHeaderDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, select")) return;
    sectionOffsetsRef.current[0] = 0; // honour "I want the top", not "where I last was in Weather"
    isNavigatingRef.current = true;
    setActiveIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (navTimeoutRef.current) window.clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = window.setTimeout(() => {
      isNavigatingRef.current = false;
    }, 600); // smooth scroll runs ~500ms; pad a touch so IO doesn't race
  };

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
    track("tab_click", { from: labels[oldIdx], to: labels[index] });
    const savedOffset = sectionOffsetsRef.current[index] ?? 0;
    window.scrollTo({
      top: target.offsetTop + savedOffset,
      behavior: "instant" as ScrollBehavior,
    });
    if (navTimeoutRef.current) window.clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = window.setTimeout(() => {
      isNavigatingRef.current = false;
    }, 200);
  }, [children.length, labels]);

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
        track("pull_to_refresh", { tab: labels[activeIndexRef.current] });
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
  }, [router, labels]);

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

      {/* Header + Tabs — fade in/out together based on scroll position */}
      <div
        onDoubleClick={onHeaderDoubleClick}
        className="fixed top-0 left-0 right-0 z-[60]"
        style={{
          opacity: headerOpacity,
          pointerEvents: headerOpacity < 0.05 ? "none" : "auto",
        }}
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
                className={`shrink-0 my-1.5 mx-0.5 px-3.5 py-1.5 rounded-full text-center text-sm whitespace-nowrap transition-all duration-200 ${
                  activeIndex === i
                    ? "bg-blue-500/15 dark:bg-blue-500/20 text-blue-500 font-semibold"
                    : "text-foreground/60 hover:text-foreground hover:bg-foreground/5 font-medium"
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
