"use client";

import type { ReactNode } from "react";
import NewsBlock from "@/components/blocks/NewsBlock";
import RedditBlock from "@/components/blocks/RedditBlock";
import NewsBriefingPlayer from "@/components/NewsBriefingPlayer";
import { IconNews, IconMessages } from "@/components/icons";
import { formatRelative } from "@/lib/date";
import type { DashboardData } from "./DesktopShell";

// Desktop Pulse: the same News + Reddit sections as the mobile FeedScreen, but
// side by side in two columns instead of stacked. Reuses NewsBlock/RedditBlock
// (and the same header markup), so the mobile FeedScreen stays untouched.
export default function PulseBoard({ data }: { data: DashboardData }) {
  const { news, redditPosts, redditFetchedAt } = data;
  return (
    <div className="grid gap-6 xl:grid-cols-2 items-start">
      <section className="min-w-0">
        <FeedHeader
          label="News"
          title="Latest Headlines"
          sub={`${news.length} ${news.length === 1 ? "story" : "stories"} · today`}
          icon={<IconNews className="w-6 h-6 text-foreground/30 shrink-0" />}
        />
        {news.length > 0 && <NewsBriefingPlayer />}
        <NewsBlock items={news} />
      </section>

      <section className="min-w-0">
        <FeedHeader
          label="Reddit"
          title="r/halifax"
          sub={`Top ${redditPosts.length} hot${
            redditFetchedAt ? ` · last change ${formatRelative(redditFetchedAt)}` : ""
          }`}
          icon={<IconMessages className="w-6 h-6 text-foreground/30 shrink-0" />}
        />
        <RedditBlock posts={redditPosts} />
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
        <h2 className="text-xl font-semibold tracking-tight text-foreground mt-0.5">{title}</h2>
        <p className="text-sm text-foreground/50 mt-0.5">{sub}</p>
      </div>
      {icon}
    </div>
  );
}
