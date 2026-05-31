import type { WinterParkingBan } from '@/lib/fetchers/winter-parking';

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

function isExpired(dateStr: string): boolean {
  if (!dateStr) return true;
  // A parking ban notice is considered stale after 7 days — by then the
  // ban would have lifted or a new notice would be issued.
  const diffMs = Date.now() - new Date(dateStr).getTime();
  return diffMs > 7 * 24 * 60 * 60 * 1000;
}

export default function WinterParkingBanBlock({ ban }: { ban: WinterParkingBan | null }) {
  if (!ban) return null;

  const expired = isExpired(ban.pubDate);
  const ago = timeAgo(ban.pubDate);

  return (
    <a
      href={ban.link}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-2xl border px-4 py-3 transition-colors ${
        expired
          ? 'border-border bg-card/50 hover:bg-card'
          : 'border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <span
          className={`shrink-0 text-xl mt-0.5 ${expired ? 'grayscale opacity-40' : ''}`}
          aria-hidden
        >
          🚫🚗
        </span>

        <div className="flex-1 min-w-0">
          {/* Status badge */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                expired
                  ? 'bg-foreground/8 text-foreground/35'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
              }`}
            >
              {expired ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/25" />
                  Expired
                </>
              ) : (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Active
                </>
              )}
            </span>
            {ago && (
              <span className="text-[10px] text-foreground/30">{ago}</span>
            )}
          </div>

          {/* Title */}
          <p
            className={`text-sm font-semibold leading-snug ${
              expired ? 'text-foreground/40' : 'text-foreground'
            }`}
          >
            {ban.title}
          </p>

          {/* Description snippet */}
          {ban.description && (
            <p
              className={`text-xs mt-1 leading-relaxed line-clamp-2 ${
                expired ? 'text-foreground/30' : 'text-foreground/60'
              }`}
            >
              {ban.description}
            </p>
          )}
        </div>

        {/* Arrow */}
        <span
          className={`shrink-0 text-sm mt-1 transition-transform group-hover:translate-x-0.5 ${
            expired ? 'text-foreground/20' : 'text-amber-500 dark:text-amber-400'
          }`}
          aria-hidden
        >
          →
        </span>
      </div>
    </a>
  );
}
