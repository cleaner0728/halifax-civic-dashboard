"use client";

import type { ReactNode } from "react";
import NewsBlock from "@/components/blocks/NewsBlock";
import NewsBriefingPlayer from "@/components/NewsBriefingPlayer";
import { IconNews } from "@/components/icons";
import type { DashboardData } from "./DesktopShell";

// Desktop Pulse: news only. Reddit / Voices moved to the dedicated
// Discussion tab. Mobile FeedScreen is unchanged — it still stacks
// News above Reddit on the same screen.
export default function PulseBoard({ data }: { data: DashboardData }) {
  const { news } = data;
  return (
    <div className="max-w-3xl">
      <FeedHeader
        label="News"
        title="Latest Headlines"
        sub={`${news.length} ${news.length === 1 ? "story" : "stories"} · today`}
        icon={<IconNews className="w-6 h-6 text-foreground/30 shrink-0" />}
      />
      {news.length > 0 && <NewsBriefingPlayer />}
      <NewsBlock items={news} />
    </div>
  );
}

function FeedHeader({
  label,
  title,
  sub,
  icon,
}: {
  label: string;
  title: string;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 mb-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-widest">
          {label}
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground mt-0.5">
          {title}
        </h2>
        <p className="text-sm text-foreground/50 mt-0.5">{sub}</p>
      </div>
      {icon}
    </div>
  );
}
