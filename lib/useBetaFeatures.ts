"use client";

import { useEffect, useState } from "react";

export const BETA_STORAGE_KEY = "betaFeatures";
const BETA_EVENT = "beta-features-change";

export function readBetaFeatures(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(BETA_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeBetaFeatures(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BETA_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(BETA_EVENT));
}

export function useBetaFeatures(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(readBetaFeatures());
    const onChange = () => setEnabled(readBetaFeatures());
    window.addEventListener(BETA_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(BETA_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return enabled;
}
