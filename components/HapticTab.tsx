"use client";

import { forwardRef, KeyboardEvent, MouseEvent, ReactNode, useRef } from "react";

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
//   - iOS: 30ms after the native toggle we re-dispatch a click on the
//     switch input. Some iOS builds emit a second taptic for the
//     re-toggle. CRITICAL: that programmatic click bubbles back up to
//     the label's onClick, so we MUST ignore non-trusted events there
//     or every real tap becomes a runaway 33-times-per-second loop
//     that pegs the main thread and makes iframe-heavy tabs (e.g.
//     Google Calendar in Events) flicker.
const HapticTab = forwardRef<HTMLLabelElement, HapticTabProps>(function HapticTab(
  { onPress, className, children, tabIndex = 0, role, ...aria },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerHaptic = () => {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([15, 40, 15]);
    }
    const el = inputRef.current;
    if (el) {
      window.setTimeout(() => { el.click(); }, 30);
    }
  };

  const handlePress = (e?: MouseEvent<HTMLLabelElement>) => {
    // Ignore our own programmatic re-toggle bubbling up. isTrusted is
    // true only for genuine user input; false for `el.click()` etc.
    if (e && e.isTrusted === false) return;
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
