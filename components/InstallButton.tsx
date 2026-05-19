"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallButton() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [env, setEnv] = useState({ installed: false, isIOS: false });
  const [canPrompt, setCanPrompt] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    // iPadOS reports as "MacIntel" — distinguish it by touch points.
    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // One-time browser-environment read; must run post-mount so server and
    // client first render agree (both render nothing).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({ installed: standalone, isIOS });

    if (standalone) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      setEnv((s) => ({ ...s, installed: true }));
      setCanPrompt(false);
      deferredPrompt.current = null;
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Hide once installed, or on browsers that can neither prompt nor be
  // installed manually (e.g. desktop Firefox).
  if (env.installed || (!canPrompt && !env.isIOS)) return null;

  const handleClick = async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === "accepted") {
        deferredPrompt.current = null;
        setCanPrompt(false);
      }
      return;
    }
    if (env.isIOS) setShowIOSHelp((v) => !v);
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="relative w-12 h-12 rounded-full flex items-center justify-center
          bg-card border-2 border-border hover:border-foreground/30
          transition-all duration-300 shadow-sm hover:shadow-md"
        aria-label="Install app"
        title="Install app"
      >
        <svg
          className="w-6 h-6 text-blue-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
          />
        </svg>
      </button>

      {showIOSHelp && (
        <>
          <div
            className="fixed inset-0 z-[70]"
            onClick={() => setShowIOSHelp(false)}
          />
          <div
            className="absolute right-0 top-full mt-2 z-[80] w-64 p-4 rounded-2xl
              bg-card border-2 border-border shadow-lg text-sm text-foreground"
          >
            <p className="font-semibold mb-1">Install this app</p>
            <p className="text-foreground/70 leading-snug">
              Tap the{" "}
              <span className="inline-flex items-center align-middle">
                <svg
                  className="w-4 h-4 inline text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V4m0 0L8 8m4-4l4 4M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
                  />
                </svg>
              </span>{" "}
              Share button in Safari, then choose{" "}
              <span className="font-medium text-foreground">
                &ldquo;Add to Home Screen&rdquo;
              </span>
              .
            </p>
          </div>
        </>
      )}
    </div>
  );
}
