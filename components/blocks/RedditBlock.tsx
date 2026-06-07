import { formatRelative } from '@/lib/date';
import type { RedditPost } from '@/lib/fetchers/reddit';
import { IconMessages } from '@/components/icons';
import RedditThumb from './RedditThumb';

type Props = {
  posts: RedditPost[];
};

export default function RedditBlock({ posts }: Props) {
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
      {posts.map((post, index) => {
        // Reddit's `thumbnail` field is either an http URL (real preview)
        // or one of the placeholder strings "self" / "default" / "nsfw" /
        // "spoiler" — only render an image for the URL case. Always small
        // (140px max from upstream), perfect for a mobile-side thumbnail
        // without burning bytes. Image posts on desktop use post.url for
        // higher quality; on mobile we deliberately stick to the cheap
        // preview so a single hot r/halifax thread can't trigger megabytes
        // of image fetches over cellular.
        const thumb =
          post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : null;
        return (
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
                    {post.numComments > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <IconMessages className="w-3.5 h-3.5" />{post.numComments}
                      </span>
                    )}
                    <span>u/{post.author}</span>
                    <span>{formatRelative(post.createdUtc * 1000)}</span>
                  </div>
                </div>
                {/* Thumbnail — plain <img>, direct from Reddit's CDN. No
                    next/image; mobile users pay for their own image
                    bytes, Vercel Image Optimization stays untouched. */}
                {thumb && (
                  <RedditThumb
                    src={thumb}
                    className="w-16 h-16 rounded-lg object-cover bg-foreground/5 shrink-0"
                  />
                )}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
