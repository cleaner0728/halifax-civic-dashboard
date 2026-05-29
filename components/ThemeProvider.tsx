"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";
import { useEffect } from "react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Arm the body's color transition only after the first paint. next-themes
  // applies the resolved theme via its blocking pre-hydration script, so the
  // correct theme is already painted by the time this effect runs; adding the
  // class here keeps theme *toggles* animated without animating the initial
  // load (which would slowly fade any pre-theme frame to dark — the white
  // flash). useEffect runs post-paint, so no rAF is needed.
  useEffect(() => {
    document.documentElement.classList.add("theme-ready");
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
