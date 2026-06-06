import { formatRelative } from '@/lib/date';
import type { RedditPost } from '@/lib/fetchers/reddit';
import { IconMessages } from '@/components/icons';

type Props = {
  posts: RedditPost[];
};

// Desktop-only Reddit card. Renders the rich Supabase fields (thumbnail,
// real Reddit flair colors, selftext preview, domain, upvote ratio, author
// flair, awards/distinguished badges). The mobile RedditBlock is unchanged
// per the project's mobile-untouched policy.
export default function RedditBlockDesktop({ posts }: Props) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 text-foreground/40">
        <IconMessages className="w-8 h-8 mb-2 text-foreground/25" />
        <p className="text-base font-medium">Unable to load posts.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id ?? post.url} post={post} />
      ))}
    </div>
  );
}

function PostCard({ post }: { post: RedditPost }) {
  const ratio =
    typeof post.upvoteRatio === 'number' ? Math.round(post.upvoteRatio * 100) : null;
  const selfPreview =
    post.selftext && post.selftext.trim().length > 0
      ? post.selftext.replace(/\s+/g, ' ').slice(0, 240).trim()
      : null;
  const showDomain = post.domain && !post.domain.startsWith('self.');

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-card rounded-xl border border-border hover:border-orange-400/40 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className="p-4 flex gap-3">
        {post.thumbnail ? (
          // Plain <img>: Reddit serves these at 140px already, no benefit
          // from next/image and avoids whitelisting preview.redd.it hosts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.thumbnail}
            alt=""
            width={80}
            height={80}
            loading="lazy"
            className="w-20 h-20 rounded-lg object-cover bg-foreground/5 shrink-0"
          />
        ) : (
          <ScoreColumn score={post.score} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {post.flair && <FlairPill post={post} />}
            {ratio !== null && ratio < 95 && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5 ${
                  ratio >= 80
                    ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10'
                    : 'text-rose-700 dark:text-rose-300 bg-rose-500/10'
                }`}
                title={`${ratio}% upvoted — contested`}
              >
                {ratio}%
              </span>
            )}
            {post.overEighteen && <Badge tone="rose">NSFW</Badge>}
            {post.spoiler && <Badge tone="slate">Spoiler</Badge>}
            {post.distinguished === 'moderator' && <Badge tone="emerald">MOD</Badge>}
            {post.distinguished === 'admin' && <Badge tone="rose">ADMIN</Badge>}
            {(post.totalAwardsReceived ?? 0) > 0 && (
              <Badge tone="amber">★ {post.totalAwardsReceived}</Badge>
            )}
          </div>

          <p className="text-base font-semibold text-foreground leading-snug">
            {post.title}
          </p>

          {selfPreview && (
            <p className="text-sm text-foreground/60 mt-1 line-clamp-2 leading-relaxed">
              {selfPreview}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-foreground/45">
            {post.thumbnail && (
              <span className="inline-flex items-center gap-1 font-semibold text-orange-500">
                ▲ {post.score}
              </span>
            )}
            {post.numComments > 0 && (
              <span className="inline-flex items-center gap-1">
                <IconMessages className="w-3.5 h-3.5" />
                {post.numComments}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              u/{post.author}
              {post.authorFlairText && (
                <span
                  className="text-[10px] text-foreground/40 bg-foreground/5 rounded px-1 py-px max-w-[140px] truncate"
                  title={post.authorFlairText}
                >
                  {post.authorFlairText}
                </span>
              )}
            </span>
            {showDomain && (
              <span className="text-foreground/35 truncate max-w-[180px]">
                {post.domain}
              </span>
            )}
            <span>{formatRelative(post.createdUtc * 1000)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

function ScoreColumn({ score }: { score: number }) {
  if (score <= 0) return <div className="w-20 shrink-0" />;
  return (
    <div className="w-20 shrink-0 flex flex-col items-center justify-center text-center bg-foreground/[0.03] rounded-lg py-2">
      <span className="text-xl font-bold text-orange-500 leading-none">▲</span>
      <span className="text-base font-bold text-foreground mt-0.5">{score}</span>
      <span className="text-[10px] text-foreground/40 uppercase tracking-wider mt-0.5">
        votes
      </span>
    </div>
  );
}

function FlairPill({ post }: { post: RedditPost }) {
  const bg = post.linkFlairBackgroundColor;
  const isLight = post.linkFlairTextColor === 'light';
  if (bg) {
    return (
      <span
        className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: bg, color: isLight ? '#fff' : '#1a1a1a' }}
      >
        {post.flair}
      </span>
    );
  }
  return (
    <span className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded px-2 py-0.5 text-[11px] font-medium">
      {post.flair}
    </span>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'rose' | 'amber' | 'emerald' | 'slate';
}) {
  const tones = {
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    slate: 'bg-foreground/5 text-foreground/60',
  } as const;
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}
