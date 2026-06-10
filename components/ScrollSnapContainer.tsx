"use client";

import { useRef, useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import HapticTab from "./HapticTab";
import { IconCity, IconPulse, IconTicket, IconChart } from "./icons";
import { useBetaFeatures } from "@/lib/useBetaFeatures";

// `icon` is a stable key (strings cross the server→client prop boundary fine;
// component functions do not). ScrollSnapContainer resolves it to a line icon.
export type TabSpec = { label: string; icon: "city" | "pulse" | "events" | "stats" };

const TAB_ICONS: Record<TabSpec["icon"], React.FC<React.SVGProps<SVGSVGElement>>> = {
  city: IconCity,
  pulse: IconPulse,
  events: IconTicket,
  stats: IconChart,
};

interface ScrollSnapContainerProps {
  children: React.ReactNode[];
  tabs: TabSpec[];
  topBar?: React.ReactNode;
}

// Single-tab-rendered architecture: only the active tab lives in the DOM.
// Switching tabs scrolls back to 0 (per design: each tab is a fresh page).
// No vertical stacking, so scrolling to the bottom of one tab does NOT
// continue into the next — users must tap a tab to change context.
export default function ScrollSnapContainer({ children, tabs: tabsProp, topBar }: ScrollSnapContainerProps) {
  const router = useRouter();
  const betaEnabled = useBetaFeatures();
  // Beta-gated tabs (currently just "stats") are filtered out when the flag
  // is off. Both the tab list and the matching children are filtered together
  // so the indices stay aligned.
  const { tabs, children: visibleChildren } = (() => {
    if (betaEnabled) return { tabs: tabsProp, children: children };
    const keptTabs: TabSpec[] = [];
    const keptChildren: React.ReactNode[] = [];
    tabsProp.forEach((tab, i) => {
      if (tab.icon === "stats") return;
      keptTabs.push(tab);
      keptChildren.push(children[i]);
    });
    return { tabs: keptTabs, children: keptChildren };
  })();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pullProgress, setPullProgress] = useState(0);
  const [isPending, startTransition] = useTransition();
  // Hide the top bar + bottom tab bar when scrolling down, reveal on scroll
  // up or near the top. Fades (opacity) + slides so it reads as a soft
  // dismiss rather than a hard cut.
  const [chromeHidden, setChromeHidden] = useState(false);

  const activeIndexRef = useRef(0);
  useEffect(() => { activeIndexRef.current = activeIndex; }, [activeIndex]);

  // If the visible tab count shrinks (e.g. user disables beta while on
  // Stats), clamp the active index back into range.
  useEffect(() => {
    if (activeIndex >= visibleChildren.length) {
      setActiveIndex(0);
    }
  }, [visibleChildren.length, activeIndex]);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const THRESHOLD = 8; // ignore jitter; only react to deliberate scrolls
    const update = () => {
      const y = window.scrollY;
      if (y < 40) {
        setChromeHidden(false);          // always show near the top
        lastY = y;
      } else if (y - lastY > THRESHOLD) {
        setChromeHidden(true);           // scrolling down
        lastY = y;
      } else if (lastY - y > THRESHOLD) {
        setChromeHidden(false);          // scrolling up
        lastY = y;
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Tab dwell-time analytics. When activeIndex changes, emit a `tab_view`
  // event for the OUTGOING tab with how long the user spent on it.
  // Threshold of 1.5s filters out drive-by switches.
  // Ref is initialized lazily inside the effect — calling Date.now() during
  // render is impure and rejected by react-hooks/purity under React 19.
  const tabEnterRef = useRef<{ tab: string; at: number } | null>(null);
  useEffect(() => {
    const prev = tabEnterRef.current;
    if (prev) {
      const elapsedMs = Date.now() - prev.at;
      if (elapsedMs >= 1500 && prev.tab !== tabs[activeIndex].label) {
        track("tab_view", { tab: prev.tab, seconds: Math.round(elapsedMs / 1000) });
      }
    }
    tabEnterRef.current = { tab: tabs[activeIndex].label, at: Date.now() };
  }, [activeIndex, tabs]);

  // Switch tab: View Transition for the cross-fade/slide if the browser
  // supports it, otherwise instant. Always scrolls to the top of the new
  // tab — tabs are independent fresh pages.
  const switchTo = useCallback((index: number) => {
    if (index < 0 || index >= visibleChildren.length) return;
    const oldIdx = activeIndexRef.current;
    if (index === oldIdx) return;

    const direction = index > oldIdx ? 1 : -1;
    const doNavigate = () => {
      setActiveIndex(index);
      track("tab_click", { from: tabs[oldIdx].label, to: tabs[index].label });
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };

    type DocWithVT = Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    const docVT = document as DocWithVT;
    if (typeof docVT.startViewTransition === "function") {
      document.documentElement.dataset.tabDirection = direction > 0 ? "forward" : "back";
      const vt = docVT.startViewTransition(doNavigate);
      vt.finished.finally(() => {
        delete document.documentElement.dataset.tabDirection;
      });
      return;
    }
    doNavigate();
  }, [visibleChildren.length, tabs]);

  // Double-click any blank surface (title, card background, page void) →
  // jump to the very top. With only one tab in the DOM at a time, "top" is
  // unambiguous: window.scrollTo(0). The dashboard-title `[data-scroll-top]`
  // element additionally returns the user to the FIRST tab (Pulse)
  // since that's the conventional "home" affordance.
  const scrollToTop = useCallback(() => {
    if (activeIndexRef.current !== 0) {
      switchTo(0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [switchTo]);

  useEffect(() => {
    const onDblClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-scroll-top]")) {
        scrollToTop();
        return;
      }
      if (t.closest("button, a, input, select, textarea, label, video, canvas, iframe, [contenteditable='true']")) {
        return;
      }
      if ((window.getSelection()?.toString() ?? "").trim().length > 0) return;
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.addEventListener("dblclick", onDblClick);
    return () => document.removeEventListener("dblclick", onDblClick);
  }, [scrollToTop]);

  // Horizontal swipe → previous/next tab. Same gesture thresholds as
  // before: 80px minimum travel, 2:1 horizontal dominance, ≤500ms.
  // Touches starting inside `[data-no-tab-swipe]` are ignored so inner
  // horizontal-scroll regions (hourly forecast, webcam pills, etc.) keep
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
      const direction = dx < 0 ? 1 : -1;
      switchTo(activeIndexRef.current + direction);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [switchTo]);

  // Custom pull-to-refresh. Native iOS PTR reloads the whole page; we'd
  // rather refetch only the RSC payload via router.refresh() and keep
  // client state. `useTransition` ties the spinner to the actual refresh
  // lifecycle rather than a fake setTimeout.
  const pullProgressRef = useRef(0);
  useEffect(() => {
    const THRESHOLD_PX = 80;
    const RATCHET = 2;
    let startY = 0;
    let pulling = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (window.scrollY > 2) return;
      // Same opt-out the swipe handler uses. Without this, iOS Safari
      // forwards iframe touches up to window listeners and arms PTR
      // when the user scrolls inside an embedded widget (Google Calendar,
      // etc.). The accidental router.refresh() that followed was making
      // the iframe reload, which iOS rendered as a flicker.
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-tab-swipe]")) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy < 0) {
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
        track("pull_to_refresh", { tab: tabs[activeIndexRef.current].label });
        startTransition(() => router.refresh());
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
  }, [router, tabs]);

  return (
    <>
      {/* Pull-to-refresh indicator */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[70] pointer-events-none transition-opacity duration-200"
        style={{ top: 96, opacity: pullProgress > 0 || isPending ? 1 : 0 }}
        aria-hidden
      >
        <div className="rounded-full bg-card/90 backdrop-blur border border-border shadow-lg p-2.5">
          {isPending ? (
            <span className="block w-5 h-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          ) : (
            <span
              className="block w-5 h-5 rounded-full border-2 border-foreground/30 border-t-foreground"
              style={{ transform: `rotate(${pullProgress * 360}deg)` }}
            />
          )}
        </div>
      </div>

      {/* Top bar — always shows brand/settings row. On md+ (iPad/desktop)
          it also shows the tab bar. Mobile gets a dedicated bottom tab bar
          (see below) for thumb reach. */}
      <div
        className={`fixed top-0 left-0 right-0 z-[60] transition-[opacity,transform] duration-300 ease-out ${
          chromeHidden ? "opacity-0 -translate-y-full pointer-events-none" : "opacity-100 translate-y-0"
        }`}
        style={{ viewTransitionName: "tab-header" }}
      >
        {topBar && (
          <div
            className="relative z-10 bg-card/90 backdrop-blur-md border-b border-border"
            data-no-tab-swipe
          >
            {topBar}
          </div>
        )}
        <div className="hidden md:block bg-card/95 backdrop-blur-md border-b border-border shadow-sm">
          <div
            data-no-tab-swipe
            className="max-w-5xl mx-auto flex justify-center"
          >
            {tabs.map((tab, i) => {
              const Icon = TAB_ICONS[tab.icon];
              return (
                <HapticTab
                  key={tab.label}
                  onPress={() => switchTo(i)}
                  role="tab"
                  className={`my-1.5 mx-0.5 px-4 py-1.5 rounded-lg text-center text-sm whitespace-nowrap cursor-pointer transition-all duration-200 flex items-center gap-2 ${
                    activeIndex === i
                      ? "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5 font-medium"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span>{tab.label}</span>
                </HapticTab>
              );
            })}
          </div>
        </div>
      </div>

      {/* Only the active tab is in the DOM. React unmounts the previous
          tab on switch — heavy client components like the webcam stop
          polling automatically. Scroll position resets on switch by
          design. */}
      <div key={activeIndex} className="min-h-dvh">
        {visibleChildren[activeIndex] ?? visibleChildren[0]}
      </div>

      {/* Mobile bottom tab bar — full-width with icon+label per tab, sits
          in the natural thumb zone. Hidden at md+ where the top tab bar
          takes over. safe-area-inset-bottom keeps it clear of the iOS
          home indicator. */}
      <nav
        data-no-tab-swipe
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-card/95 backdrop-blur-md border-t border-border transition-[opacity,transform] duration-300 ease-out ${
          chromeHidden ? "opacity-0 translate-y-full pointer-events-none" : "opacity-100 translate-y-0"
        }`}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          viewTransitionName: "tab-dots",
        }}
        aria-label="Primary"
      >
        <div className="flex">
          {tabs.map((tab, i) => {
            const active = activeIndex === i;
            const Icon = TAB_ICONS[tab.icon];
            return (
              <HapticTab
                key={tab.label}
                onPress={() => switchTo(i)}
                aria-label={`Switch to ${tab.label}`}
                // Comfortable thumb-sized target: line icon + label + padding.
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors duration-150 ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-foreground/50 hover:text-foreground/80"
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={active ? 2.25 : 2} />
                <span className={`text-xs ${active ? "font-semibold" : "font-medium"}`}>
                  {tab.label}
                </span>
              </HapticTab>
            );
          })}
        </div>
      </nav>
    </>
  );
}
