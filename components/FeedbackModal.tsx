"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@vercel/analytics";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xaqkjngq";

type Status = "idle" | "sending" | "sent" | "error";

export default function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Reset the form when the sheet closes so the next open starts fresh.
  // Done with the "adjust state during render" pattern (tracking the previous
  // `open`) rather than an effect — this is React's recommended approach and
  // sidesteps the set-state-in-effect rule.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setStatus("idle");
      setErrorMsg(null);
      setMessage("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => messageRef.current?.focus(), 80);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const canSend = message.trim().length > 0 && status !== "sending" && status !== "sent";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setStatus("sending");
    setErrorMsg(null);
    track("feedback_submit");
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          message: message.trim(),
          _subject: "Made in Halifax feedback",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.errors?.[0]?.message ?? `Send failed (${res.status}).`
        );
      }
      setStatus("sent");
      setTimeout(() => onClose(), 2500);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Send failed.");
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[101] flex justify-center"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <form
          onSubmit={submit}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="w-full max-w-lg bg-card border border-border border-b-0 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: "85dvh" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-foreground/20" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 shrink-0">
            <span id="feedback-title" className="text-base font-semibold">
              Say something 👋
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-7 h-7 rounded-full flex items-center justify-center text-foreground/50 hover:text-foreground hover:bg-foreground/8 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {status === "sent" ? (
            /* ── Success state ── */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <span className="text-5xl">💌</span>
              <p className="text-lg font-semibold">Got it, thanks!</p>
              <p className="text-sm text-foreground/50">
                I&apos;ll read this and get back to you if you left an email.
              </p>
            </div>
          ) : (
            <>
              {/* Message textarea — the hero */}
              <textarea
                ref={messageRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={"Ideas, bugs, things you love or hate...\nI read every message."}
                className="flex-1 min-h-[140px] px-5 py-2 text-[15px] leading-relaxed text-foreground bg-transparent placeholder:text-foreground/30 focus:outline-none resize-none"
                disabled={status === "sending"}
              />

              {/* Footer compose bar */}
              <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com (optional)"
                  disabled={status === "sending"}
                  className="flex-1 min-w-0 bg-foreground/6 rounded-full px-3.5 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:outline-none focus:bg-foreground/10 transition-colors"
                />

                {/* Paper-plane send button */}
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send feedback"
                  className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200
                    bg-blue-500 hover:bg-blue-400 disabled:bg-foreground/10 disabled:text-foreground/25 text-white"
                >
                  {status === "sending" ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Error toast */}
              {status === "error" && errorMsg && (
                <p className="shrink-0 px-5 pb-3 text-xs text-red-500" role="alert">
                  {errorMsg}
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </>,
    document.body
  );
}
