"use client";

import { forwardRef, KeyboardEvent, ReactNode } from "react";

type HapticTabProps = {
  onPress: () => void;
  className?: string;
  children?: ReactNode;
  tabIndex?: number;
  role?: string;
  "aria-label"?: string;
};

// iOS 17.4+ Safari fires a Taptic Engine pulse whenever a native
// <input type="checkbox" switch> toggles from a real touch. We layer
// an invisible one over the tab so the user's tap lands on it and
// gets the haptic; everywhere else it's an inert hidden checkbox.
const HapticTab = forwardRef<HTMLLabelElement, HapticTabProps>(function HapticTab(
  { onPress, className, children, tabIndex = 0, role, ...aria },
  ref,
) {
  const onKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPress();
    }
  };

  return (
    <label
      ref={ref}
      role={role}
      tabIndex={tabIndex}
      onClick={onPress}
      onKeyDown={onKeyDown}
      className={`relative ${className ?? ""}`}
      {...aria}
    >
      <input
        type="checkbox"
        {...({ switch: "" } as Record<string, string>)}
        tabIndex={-1}
        aria-hidden
        onChange={() => {}}
        className="absolute inset-0 opacity-0 m-0 cursor-pointer"
      />
      {children}
    </label>
  );
});

export default HapticTab;
