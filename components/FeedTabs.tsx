"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconNews, IconMessages } from "@/components/icons";

// Mobile Pulse screen: folder-style tabs that read as ONE shape with the panel.
// Two tabs split the width 50/50 (a small gap between them), each with both top
// corners rounded. The active tab is accent-filled and sits on the panel's bold
// accent border (4px all round) so tab + border read as one folder. Only one
// feed shows at a time, but BOTH stay mounted (inactive is display:none) so a
// playing briefing survives a switch. The choice persists in localStorage.

type Tab = "news" | "reddit";
const STORAGE_KEY = "hfx-feed-tab-v1";

export default function FeedTabs({
  news,
  reddit,
}: {
  news: ReactNode;
  reddit: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("news");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "news" || saved === "reddit") setTab(saved);
  }, []);

  const choose = (t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // private mode — selection still applies for this view
    }
  };

  // Whole panel border = the active feed's accent, a uniform 4px all round.
  const panelBorder = tab === "news" ? "border-blue-500" : "border-orange-500";

  return (
    <div>
      <div role="tablist" aria-label="Feed source" className="flex gap-2">
        <FolderTab
          active={tab === "news"}
          onClick={() => choose("news")}
          accent="blue"
          icon={<IconNews className="w-4 h-4" />}
          label="News"
        />
        <FolderTab
          active={tab === "reddit"}
          onClick={() => choose("reddit")}
          accent="orange"
          icon={<IconMessages className="w-4 h-4" />}
          label="Reddit"
        />
      </div>

      {/* Panel: uniform 4px accent border all round; the top edge is the bold
          sill the tabs sit on. Both sections stay mounted; inactive is
          display:none so <audio> keeps playing across a tab switch. */}
      <div className={`rounded-b-2xl border-4 ${panelBorder} bg-card px-1 py-3`}>
        <div className={tab === "news" ? "" : "hidden"}>{news}</div>
        <div className={tab === "reddit" ? "" : "hidden"}>{reddit}</div>
      </div>
    </div>
  );
}

function FolderTab({
  active,
  onClick,
  accent,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  accent: "blue" | "orange";
  icon: ReactNode;
  label: string;
}) {
  const activeBg = accent === "blue" ? "bg-blue-500" : "bg-orange-500";

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        // flex-1 → each tab is half the width; both top corners rounded.
        "flex-1 flex items-center justify-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold transition-colors " +
        (active
          ? `${activeBg} text-white`
          : "bg-foreground/[0.04] text-foreground/55 hover:text-foreground/80 hover:bg-foreground/[0.07]")
      }
    >
      {icon}
      {label}
    </button>
  );
}
