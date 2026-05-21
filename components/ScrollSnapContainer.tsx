"use client";

import { useRef, useState, useEffect } from "react";

interface ScrollSnapContainerProps {
  children: React.ReactNode[];
  labels: string[];
  topBar?: React.ReactNode;
}

export default function ScrollSnapContainer({ children, labels, topBar }: ScrollSnapContainerProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  // Suppress IO-driven activeIndex updates during programmatic tab navigation
  // so we don't flicker through every screen we pass over.
  const isNavigatingRef = useRef(false);
  const navTimeoutRef = useRef<number | null>(null);

  // Auto-scroll the tab bar so the active tab is centered
  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex];
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeIndex]);

  // Whenever the active screen changes (tab click or scroll-snap), bring the
  // header back. Otherwise its hidden state from the previous screen carries
  // over and the user has to manually scroll up to re-summon it.
  useEffect(() => {
    setIsHeaderHidden(false);
  }, [activeIndex]);

  useEffect(() => {
    // `root: null` observes against the viewport. Sections are now direct
    // document children (the body scrolls, not a custom container), so the
    // viewport IS the scroll root.
    // rootMargin shrinks the observation band to a 1px line at the center:
    // exactly one section's midpoint can cross it at a time, so we never
    // flicker between two ≥60%-visible sections during rubber-band.
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
      {
        root: null,
        rootMargin: "-50% 0px -50% 0px",
        threshold: 0,
      }
    );

    const sections = document.querySelectorAll("[data-snap-section]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  // Header hide/show driven by document scroll. We listen on `window` instead
  // of a custom container so iOS Safari can hand the scroll off to its
  // native UIScrollView (best-in-class momentum + bounce). Custom-div
  // overflow scrolling never feels quite as fluid even with
  // -webkit-overflow-scrolling: touch.
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

      if (delta > 0 && withinScreen > HIDE_AFTER) {
        setIsHeaderHidden(true);
      } else if (delta < -SHOW_DELTA && !nearBottom) {
        setIsHeaderHidden(false);
      }
      lastScrollY = scrollTop <= 0 ? 0 : scrollTop;
    };

    const onScroll = () => {
      // rAF-throttle: 60+ scroll events/sec → at most 1 React state update
      // per frame. Keeps the scroll thread clear for momentum.
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const scrollTo = (index: number) => {
    const target = document.querySelector(
      `[data-snap-section="${index}"]`,
    ) as HTMLElement | null;
    if (!target) return;
    // Instant jump avoids a ~1s animated scroll across many screens, during
    // which the IntersectionObserver would otherwise fire for every
    // intermediate screen and the tab bar would visibly cycle.
    isNavigatingRef.current = true;
    setActiveIndex(index);
    window.scrollTo({ top: target.offsetTop, behavior: "instant" as ScrollBehavior });
    if (navTimeoutRef.current) window.clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = window.setTimeout(() => {
      isNavigatingRef.current = false;
    }, 150);
  };

  return (
    <>
      {/* Header + Tabs — slide out together as one unit */}
      <div
        className={`fixed top-0 left-0 right-0 z-[60] transition-transform duration-300 ease-in-out ${
          isHeaderHidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        {topBar && (
          // relative + z-10 keeps absolutely-positioned children (e.g. the
          // LanguageToggle dropdown) above the sibling tab bar's stacking
          // context, which backdrop-blur otherwise pins under.
          <div className="relative z-10 bg-card/90 backdrop-blur-md border-b border-border">
            {topBar}
          </div>
        )}
        <div className="bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
          <div className="max-w-5xl mx-auto flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {labels.map((label, i) => (
              <button
                key={i}
                ref={(el) => { tabRefs.current[i] = el; }}
                onClick={() => scrollTo(i)}
                className={`shrink-0 px-3.5 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-all duration-200 border-b-2 ${
                  activeIndex === i
                    ? "border-blue-500 text-blue-500 bg-blue-500/5 dark:bg-blue-500/10"
                    : "border-transparent text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sections render directly in document flow. The body scrolls, not a
          nested div — which is the whole point of this layout: iOS hands
          body scroll to its native UIScrollView, giving real momentum,
          inertia, and bounce. Snap is configured on <html> in layout.tsx
          (it has to live on the actual scrolling element). */}
      {children.map((child, i) => (
        <div
          key={i}
          data-snap-section={i}
          className="min-h-dvh snap-start"
        >
          {child}
        </div>
      ))}
    </>
  );
}
