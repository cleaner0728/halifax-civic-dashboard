"use client";

import { useState, useEffect } from "react";

export default function LiveClock({ className }: { className?: string }) {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Halifax",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short",
      });
      setTimeStr(formatter.format(now));
    };

    updateTime(); // set immediately
    const intervalId = setInterval(updateTime, 1000); // update every second to ensure minute rolls over exactly
    return () => clearInterval(intervalId);
  }, []);

  if (!timeStr) {
    return <span className={className}>--:--</span>;
  }

  return <span className={className}>{timeStr}</span>;
}
