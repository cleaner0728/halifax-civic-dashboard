"use client";

import { useRef, useState, useEffect } from "react";

interface ScrollSnapContainerProps {
  children: React.ReactNode[];
  labels: string[];
  topBar?: React.ReactNode;
}

export default function ScrollSnapContainer({ children, labels, topBar }: ScrollSnapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    const container = containerRef.current;
    if (!container) return;

    // rootMargin trick: shrink the viewport to a 1px-tall band at the center.
    // The single screen whose middle crosses that band is the active one — no
    // ambiguity during rubber-band, no fighting between two ≥60%-visible
    // sections at the same time.
    const observer = new IntersectionObserver(
      (entries) => {
        if (isNavigatingRef.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index)) setActiveIndex(index);
          }
        });
      },
      {
        root: container,
        rootMargin: "-50% 0px -50% 0px",
        threshold: 0,
      }
    );

    const sections = container.querySelectorAll("[data-index]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  // Header hide/show driven by the OUTER container's scrollTop. We compute
  // distance past the nearest snap point so the header re-appears when the
  // user lands on a new screen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const HIDE_AFTER = 60;
    const SHOW_DELTA = 8;
    const BOTTOM_GUARD = 24;

    let lastScrollY = container.scrollTop;
    let raf = 0;

    const update = () => {
      raf = 0;
      const scrollTop = container.scrollTop;
      const delta = scrollTop - lastScrollY;
      const screenH = container.clientHeight;
      const snapPos = Math.round(scrollTop / screenH) * screenH;
      const withinScreen = scrollTop - snapPos;
      const maxScroll = container.scrollHeight - container.clientHeight;
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
      // per frame. Cuts down the re-render storm during fast swipes.
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const scrollTo = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-index="${index}"]`) as HTMLElement | null;
    if (!target) return;
    // Instant jump (not smooth) avoids a ~1s animated scroll across many
    // screens, during which the IntersectionObserver would otherwise fire
    // for every intermediate screen and the tab bar would visibly cycle.
    isNavigatingRef.current = true;
    setActiveIndex(index);
    container.scrollTo({ top: target.offsetTop, behavior: "instant" as ScrollBehavior });
    if (navTimeoutRef.current) window.clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = window.setTimeout(() => {
      isNavigatingRef.current = false;
    }, 150);
  };

  return (
    <div className="relative h-screen">
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

      {/* Single scroll container. Children are min-h-screen sections that
          snap on settle. `proximity` (not `mandatory`) so users can freely
          scroll through long content inside one screen without being yanked
          back to the snap point. */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        style={{
          scrollSnapType: "y proximity",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            data-index={i}
            className="min-h-screen"
            style={{ scrollSnapAlign: "start" }}
          >
            {child}
          </div>
        ))}
      </div>

    </div>
  );
}
