import { formatRelative } from '@/lib/date';
import type { RedditPost } from '@/lib/fetchers/reddit';
import { IconMessages } from '@/components/icons';
import RedditThumb from './RedditThumb';

type Props = {
  posts: RedditPost[];
};

// Desktop-only Reddit tile grid. Each card is roughly square so the grid
// tiles densely across any viewport. Renders the rich Supabase fields
// (thumbnail, real Reddit flair colors, selftext preview, domain, upvote
// ratio, author flair, awards/distinguished badges). The mobile RedditBlock
// is unchanged per the project's mobile-untouched policy.
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
    <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
      {posts.map((post) => (
        <PostCard key={post.id ?? post.url} post={post} />
      ))}
    </div>
  );
}

// Pick the best image we can render directly without Vercel Image
// Optimization. For native image posts (post_hint === "image") the post's
// `url` itself is a direct image on Reddit's CDN (i.redd.it) or imgur —
// highest quality available. For link posts we fall back to Reddit's
// 140px preview thumbnail; small but signed (changing the width
// parameter invalidates the signature so we can't request a larger one
// without parsing the preview JSON). Self posts and posts whose
// thumbnail is one of Reddit's placeholder strings ("self", "default",
// "nsfw", "spoiler") get no hero.
function heroImageUrl(post: RedditPost): string | null {
  if (post.postHint === 'image' && post.url) return post.url;
  if (post.thumbnail && post.thumbnail.startsWith('http')) return post.thumbnail;
  return null;
}

function PostCard({ post }: { post: RedditPost }) {
  const ratio =
    typeof post.upvoteRatio === 'number' ? Math.round(post.upvoteRatio * 100) : null;
  const selfPreview =
    post.selftext && post.selftext.trim().length > 0
      ? post.selftext.replace(/\s+/g, ' ').slice(0, 240).trim()
      : null;
  const showDomain = post.domain && !post.domain.startsWith('self.');
  const hero = heroImageUrl(post);

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      className="aspect-square block bg-card rounded-xl border border-border hover:border-orange-400/40 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className="flex flex-col h-full">
        {/* Hero strip — plain <img> on purpose so each visitor fetches the
            source CDN directly. Routing through next/image would bill
            Vercel Image Optimization per (src, width, quality, format)
            tuple, and Reddit's CDN already serves WebP/JPEG efficiently.
            referrerPolicy keeps our domain out of upstream referer logs;
            onError hides broken-image placeholders gracefully. */}
        {hero && (
          <RedditThumb
            src={hero}
            className="w-full h-32 object-cover bg-foreground/5 shrink-0"
          />
        )}

        <div className="flex flex-col flex-1 min-h-0 p-4">
          {/* Top row: flair pills + badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2 shrink-0">
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

          {/* Title — full width now that the hero replaces the inline
              thumbnail. */}
          <p className="text-base font-semibold text-foreground leading-snug line-clamp-3 shrink-0">
            {post.title}
          </p>

          {/* Body — fills remaining vertical room; clipped with line-clamp so
              tiles stay square no matter how long the selftext is. */}
          <div className="flex-1 min-h-0 mt-2">
            {selfPreview && (
              <p
                className={`text-sm text-foreground/60 leading-relaxed ${
                  hero ? 'line-clamp-2' : 'line-clamp-4'
                }`}
              >
                {selfPreview}
              </p>
            )}
          </div>

          {/* Meta footer */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-foreground/45 shrink-0">
            <span className="inline-flex items-center gap-1 font-semibold text-orange-500">
              ▲ {post.score}
            </span>
            {post.numComments > 0 && (
              <span className="inline-flex items-center gap-1">
                <IconMessages className="w-3.5 h-3.5" />
                {post.numComments}
              </span>
            )}
            <span className="inline-flex items-center gap-1 min-w-0">
              <span className="truncate">u/{post.author}</span>
            </span>
            {showDomain && (
              <span className="text-foreground/35 truncate max-w-[140px]">
                {post.domain}
              </span>
            )}
            <span className="ml-auto">{formatRelative(post.createdUtc * 1000)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

function FlairPill({ post }: { post: RedditPost }) {
  const bg = post.linkFlairBackgroundColor;
  const isLight = post.linkFlairTextColor === 'light';
  if (bg) {
    return (
      <span
        className="inline-block rounded px-2 py-0.5 text-[11px] font-medium truncate max-w-[160px]"
        style={{ backgroundColor: bg, color: isLight ? '#fff' : '#1a1a1a' }}
      >
        {post.flair}
      </span>
    );
  }
  return (
    <span className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded px-2 py-0.5 text-[11px] font-medium truncate max-w-[160px]">
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
