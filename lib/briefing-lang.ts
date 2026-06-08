// Which language the briefing players should request, derived from Google
// Translate's `googtrans` cookie (set by the in-app language menu). Chinese
// (Simplified or Traditional) → the pre-generated Chinese audio; every other
// language, or none, → English (the default). Shared by both the news and
// Reddit briefing players so the rule stays identical.

export type BriefingLang = "en" | "zh";

export function currentBriefingLang(): BriefingLang {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(/googtrans=\/[^/]+\/([^;]+)/);
  const code = m ? decodeURIComponent(m[1]) : null;
  return code === "zh-CN" || code === "zh-TW" ? "zh" : "en";
}
