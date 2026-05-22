'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// iOS home-screen PWAs are resumed from a snapshot — reopening the icon often
// skips navigation entirely, so the server component never re-runs and the
// dashboard sits on stale data. Listen for the tab becoming visible (or a
// bfcache restore) and quietly trigger router.refresh(), which re-runs the
// RSC tree in place without losing scroll position or client state.
const MIN_INTERVAL_MS = 60_000;

export default function RefreshOnVisible() {
  const router = useRouter();
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    const maybeRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt.current < MIN_INTERVAL_MS) return;
      lastRefreshAt.current = now;
      router.refresh();
    };

    const onPageShow = (e: PageTransitionEvent) => {
      // persisted = restored from bfcache; treat as a fresh resume.
      if (e.persisted) maybeRefresh();
    };

    document.addEventListener('visibilitychange', maybeRefresh);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', maybeRefresh);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [router]);

  return null;
}
