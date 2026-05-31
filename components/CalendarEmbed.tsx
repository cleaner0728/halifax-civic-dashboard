"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function CalendarEmbed({ src }: { src: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div
      data-no-tab-swipe
      className="rounded-xl overflow-hidden border border-border shadow-sm p-2"
      // Keep a white bg so the iframe's own white background shows cleanly in
      // light mode; in dark mode the invert filter turns it dark anyway.
      style={{ backgroundColor: isDark ? "#111" : "#fff" }}
    >
      <iframe
        data-no-tab-swipe
        src={src}
        style={{
          border: 0,
          // invert(1) flips white→black; hue-rotate(180deg) spins colour hues
          // back so event colours stay recognisable rather than becoming
          // their complementary opposites.
          filter: isDark ? "invert(1) hue-rotate(180deg)" : "none",
          transition: "filter 0.2s",
        }}
        width="100%"
        height="480"
        title="HRM Events Calendar"
      />
    </div>
  );
}
