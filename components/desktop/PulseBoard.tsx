"use client";

import type { ReactNode } from "react";
import NewsBlockDesktop from "@/components/blocks/NewsBlockDesktop";
import NewsBriefingPlayer from "@/components/NewsBriefingPlayer";
import RedditBlockDesktop from "@/components/blocks/RedditBlockDesktop";
import RedditBriefingPlayer from "@/components/RedditBriefingPlayer";
import { IconNews, IconMessages } from "@/components/icons";
import { formatRelative } from "@/lib/date";
import type { DashboardData } from "./DesktopShell";

// Desktop Pulse: Reddit + News side by side. Reddit leads on the LEFT so it's
// the first thing users see when they land — Pulse is now the default tab. News
// sits on the right. The full r/halifax deep-dive (Voices + every thread) still
// lives on the dedicated Discussion tab. Mobile FeedScreen is unchanged — it
// still tabs between News and Reddit via FeedTabs.
export default function PulseBoard({ data }: { data: DashboardData }) {
  const { news, redditPosts, redditFetchedAt } = data;
  return (
    // Two equal columns from xl up; stacks to one column below that (the desktop
    // shell only mounts at xl anyway, so the single-column case is a safety net).
    // items-start lets each column grow to its own content height.
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      {/* Left — Reddit, seen first. */}
      <section className="min-w-0">
        <FeedHeader
          label="Discussion"
          title="r/halifax"
          sub={`Top ${redditPosts.length} hot${
            redditFetchedAt ? ` · last change ${formatRelative(redditFetchedAt)}` : ""
          }`}
          icon={<IconMessages className="w-6 h-6 text-foreground/30 shrink-0" />}
        />
        {redditPosts.length > 0 && <RedditBriefingPlayer />}
        <RedditBlockDesktop posts={redditPosts} />
      </section>

      {/* Right — News. */}
      <section className="min-w-0">
        <FeedHeader
          label="News"
          title="Latest Headlines"
          sub={`${news.length} ${news.length === 1 ? "story" : "stories"} · today`}
          icon={<IconNews className="w-6 h-6 text-foreground/30 shrink-0" />}
        />
        {news.length > 0 && <NewsBriefingPlayer />}
        <NewsBlockDesktop items={news} />
      </section>
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
