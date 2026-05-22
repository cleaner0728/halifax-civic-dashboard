import { formatRelative } from '@/lib/date';
import type { RedditPost } from '@/lib/fetchers/reddit';

type Props = {
  posts: RedditPost[];
  fetchedAt: string | null;
};

export default function RedditScreen({ posts, fetchedAt }: Props) {
  return (
    <div className="pt-20 pb-4 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 dark:from-orange-900 dark:via-red-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Reddit</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">r/halifax</h2>
              <p className="text-base text-white/70 mt-1">
                Top {posts.length} hot posts
                {/* `fetchedAt` reflects the last time the post list actually
                    changed (score/comments/order/new post), not the last
                    poll — the GitHub Action runs every 30 min but only
                    rewrites public/reddit.json when something differs.
                    Phrasing this as "last change" + a steady "checked every
                    30 min" hint keeps the UI honest on quiet nights. */}
                {fetchedAt
                  ? ` · last change ${formatRelative(fetchedAt)} · checked every 30 min`
                  : ' · checked every 30 min'}{' '}
                ·{' '}
                <a
                  href="https://www.reddit.com/r/halifax"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  reddit.com/r/halifax
                </a>
              </p>
            </div>
            <div className="text-5xl">🗣️</div>
          </div>
        </div>

        <div className="space-y-3 pb-16">
          {posts.length === 0 ? (
            <div className="text-center py-16 text-foreground/40">
              <p className="text-4xl mb-4">💬</p>
              <p className="text-lg font-medium">Unable to load posts.</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <a
                key={index}
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card rounded-xl border border-border hover:border-orange-400/40 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {post.score > 0 && (
                      <div className="flex flex-col items-center min-w-[40px] text-center">
                        <span className="text-lg font-bold text-orange-500">▲</span>
                        <span className="text-sm font-bold text-foreground">{post.score}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {post.flair && (
                        <span className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded px-2 py-0.5 text-xs font-medium mb-1.5">
                          {post.flair}
                        </span>
                      )}
                      <p className="text-base font-semibold text-foreground leading-snug">{post.title}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-foreground/40">
                        {post.numComments > 0 && <span>💬 {post.numComments}</span>}
                        <span>u/{post.author}</span>
                        <span>{formatRelative(post.createdUtc * 1000)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
