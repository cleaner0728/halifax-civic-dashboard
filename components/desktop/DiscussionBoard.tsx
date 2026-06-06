"use client";

import type { ReactNode } from "react";
import RedditBlockDesktop from "@/components/blocks/RedditBlockDesktop";
import VoicesBlock from "@/components/blocks/VoicesBlock";
import RedditBriefingPlayer from "@/components/RedditBriefingPlayer";
import { IconMessages } from "@/components/icons";
import { formatRelative } from "@/lib/date";
import type { DashboardData } from "./DesktopShell";

// "Discussion" — the r/halifax civic-discussion tab. Audio briefing at the
// top, citizen-quote highlights ("Voices") in the middle, full hot-posts
// feed at the bottom. Desktop only; mobile still surfaces Reddit via the
// existing FeedScreen.
export default function DiscussionBoard({ data }: { data: DashboardData }) {
  const { redditPosts, redditFetchedAt, redditVoices } = data;
  return (
    <div className="space-y-8">
      <section className="min-w-0">
        <Header
          label="Discussion"
          title="r/halifax"
          sub={`Top ${redditPosts.length} hot${
            redditFetchedAt ? ` · last change ${formatRelative(redditFetchedAt)}` : ""
          }`}
          icon={<IconMessages className="w-6 h-6 text-foreground/30 shrink-0" />}
        />
        {redditPosts.length > 0 && <RedditBriefingPlayer />}
      </section>

      {redditVoices.length > 0 && (
        <section className="min-w-0">
          <Header
            label="Voices"
            title="What citizens are saying"
            sub={`${redditVoices.length} top comments · one per thread`}
            icon={<IconMessages className="w-6 h-6 text-foreground/30 shrink-0" />}
          />
          <VoicesBlock voices={redditVoices} />
        </section>
      )}

      <section className="min-w-0">
        <Header
          label="Threads"
          title="All discussions"
          sub={`${redditPosts.length} hot posts from r/halifax`}
          icon={<IconMessages className="w-6 h-6 text-foreground/30 shrink-0" />}
        />
        <RedditBlockDesktop posts={redditPosts} />
      </section>
    </div>
  );
}

function Header({
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
