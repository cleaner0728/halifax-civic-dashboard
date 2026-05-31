"use client";

import { useBetaFeatures } from "@/lib/useBetaFeatures";

export default function BetaOnly({ children }: { children: React.ReactNode }) {
  const enabled = useBetaFeatures();
  if (!enabled) return null;
  return <>{children}</>;
}
