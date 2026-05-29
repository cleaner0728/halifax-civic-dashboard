import type { HrmItem } from '@/lib/fetchers/hrm';
import { formatRelative } from '@/lib/date';
import { IconInbox } from '@/components/icons';

type Props = {
  items: HrmItem[];
};

export default function HrmNewsBlock({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-10 text-foreground/40">
        <IconInbox className="w-8 h-8 mb-2 text-foreground/25" />
        <p className="text-base font-medium">No HRM news published recently.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <a
          key={item.link ?? item.title}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group block bg-card rounded-xl border border-border hover:border-emerald-500/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
        >
          <article className="p-3">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug">
              {item.title}
            </h3>
            <p className="text-xs text-foreground/40 mt-1 font-mono">
              {formatRelative(item.pubDate) || 'Unknown'}
            </p>
            {item.description && (
              <p className="text-foreground/60 mt-1 text-base leading-relaxed">{item.description}</p>
            )}
          </article>
        </a>
      ))}
    </div>
  );
}
