"use client";

import { useRef, useState, useEffect, useCallback } from "react";

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

  // Auto-scroll the tab bar so the active tab is centered
  useEffect(() => {
    const activeTab = tabRefs.current[activeIndex];
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index)) setActiveIndex(index);
          }
        });
      },
      {
        root: container,
        threshold: 0.6,
      }
    );

    const sections = container.querySelectorAll("[data-index]");
    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Hide once we've scrolled this far past the top.
    const HIDE_AFTER = 60;
    // Require a deliberate upward swipe to bring the header back — filters
    // out 1-px jitter from scroll-snap and iOS rubber-band at the bottom.
    const SHOW_DELTA = 8;
    // When the content is within this many pixels of the bottom, ignore
    // upward deltas entirely (rubber-band bounce reads as upward scroll).
    const BOTTOM_GUARD = 24;

    let lastScrollY = 0;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      // Each screen's outer wrapper carries `data-screen-scroll`; only those
      // contribute to the header hide/show heuristic. Matching by className
      // was fragile — anything tagged `overflow-y-auto` would trigger.
      if (!target.hasAttribute('data-screen-scroll') || target === container) return;

      const currentScrollY = target.scrollTop;
      const delta = currentScrollY - lastScrollY;
      const maxScroll = target.scrollHeight - target.clientHeight;
      const nearBottom = currentScrollY >= maxScroll - BOTTOM_GUARD;

      if (delta > 0 && currentScrollY > HIDE_AFTER) {
        setIsHeaderHidden(true); // Scrolling down -> hide header
      } else if (delta < -SHOW_DELTA && !nearBottom) {
        setIsHeaderHidden(false); // Deliberate upward swipe -> show header
      }
      lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
    };

    container.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => container.removeEventListener("scroll", handleScroll, { capture: true });
  }, []);

  const scrollTo = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector(`[data-index="${index}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <div className="bg-card/90 backdrop-blur-md border-b border-border">
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
                className={`shrink-0 px-5 py-3 text-center text-lg font-medium whitespace-nowrap transition-all duration-200 border-b-[3px] ${
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

      {/* Scroll snap container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        style={{
          scrollSnapType: "y mandatory",
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
