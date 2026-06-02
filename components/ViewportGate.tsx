"use client";

import { lazy, Suspense, useState, useEffect, type ReactNode } from "react";
import type { DashboardData } from "./desktop/DesktopShell";

// Lazily loaded so the desktop bundle is fetched ONLY when a wide viewport
// actually renders it. Phones below the breakpoint never download this code.
const DesktopShell = lazy(() => import("./desktop/DesktopShell"));

// 1280px (Tailwind `xl`). Below this the existing mobile tree renders, byte for
// byte unchanged; at/above it we swap in the desktop dashboard.
const DESKTOP_QUERY = "(min-width: 1280px)";

export default function ViewportGate({
  mobile,
  data,
}: {
  mobile: ReactNode;
  data: DashboardData;
}) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const update = () => {
      // Keep <html data-vw> in lockstep with the live viewport, and crucially
      // set it BEFORE the state update so it's already correct when React
      // paints the new tree. The pre-paint script in layout.tsx only sets it
      // once; without this sync, resizing desktop→mobile would leave
      // data-vw="desktop" stale, and the globals.css rule that hides
      // [data-mobile-root] on desktop would keep the mobile tree hidden — a
      // blank, "stuck" screen.
      document.documentElement.dataset.vw = mq.matches ? "desktop" : "mobile";
      setIsDesktop(mq.matches);
    };
    update(); // sync on mount
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (isDesktop === true) {
    return (
      <Suspense fallback={<BootScreen />}>
        <DesktopShell data={data} />
      </Suspense>
    );
  }

  // `null` (pre-mount, the SSR default) and `false` (confirmed narrow) both
  // render the untouched mobile tree. The [data-mobile-root] wrapper is
  // display:contents on phones (zero layout effect); on wide screens a CSS
  // rule hides it during the brief pre-mount window so desktop users never
  // glimpse the phone layout before the shell mounts. See globals.css.
  return <div data-mobile-root>{mobile}</div>;
}

function BootScreen() {
  return (
    <div className="min-h-dvh grid place-items-center bg-background" aria-hidden>
      <span className="w-6 h-6 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
    </div>
  );
}
