"use client";

import { forwardRef, KeyboardEvent, ReactNode, useRef } from "react";

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
//
// "Doubled" feel comes from two complementary tricks:
//   - Android: navigator.vibrate([15, 40, 15]) emits two short pulses
//     ~40ms apart, which the body perceives as one strong tap rather
//     than two separate buzzes.
//   - iOS: we re-dispatch a synthetic click on the switch input ~30ms
//     after the native toggle. Some iOS builds fire a second taptic
//     for the re-toggle; the worst case is silent (cost-free).
//   - navigator.vibrate is a no-op on iOS Safari (the API is blocked),
//     so the two paths don't double-trigger each other.
const HapticTab = forwardRef<HTMLLabelElement, HapticTabProps>(function HapticTab(
  { onPress, className, children, tabIndex = 0, role, ...aria },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([15, 40, 15]);
    }
    // Re-toggle the switch shortly after the native click landed.
    // iOS treats the input's `click()` as a fresh interaction in
    // some builds and emits a second taptic.
    const el = inputRef.current;
    if (el) {
      window.setTimeout(() => { el.click(); }, 30);
    }
  };

  const handlePress = () => {
    triggerHaptic();
    onPress();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handlePress();
    }
  };

  return (
    <label
      ref={ref}
      role={role}
      tabIndex={tabIndex}
      onClick={handlePress}
      onKeyDown={onKeyDown}
      className={`relative ${className ?? ""}`}
      {...aria}
    >
      <input
        ref={inputRef}
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
