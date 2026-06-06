import { formatRelative } from '@/lib/date';
import type { RedditVoice } from '@/lib/fetchers/reddit-voices';
import { IconMessages } from '@/components/icons';

type Props = {
  voices: RedditVoice[];
};

// Desktop-only "what citizens are saying" block. Each tile is a single
// high-score Reddit comment quoted under the post it came from. Capped to
// one comment per post upstream so a single viral thread doesn't dominate.
export default function VoicesBlock({ voices }: Props) {
  if (voices.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {voices.map((v) => (
        <VoiceCard key={v.id} voice={v} />
      ))}
    </div>
  );
}

function VoiceCard({ voice }: { voice: RedditVoice }) {
  const body = voice.body.replace(/\s+/g, ' ').trim();
  const truncated = body.length > 280 ? body.slice(0, 280).trimEnd() + '…' : body;
  return (
    <a
      href={voice.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-card rounded-xl border border-border hover:border-orange-400/40 shadow-sm hover:shadow-md transition-all p-4"
    >
      <div className="flex items-center gap-2 mb-2 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold text-orange-500">
          ▲ {voice.score}
        </span>
        <span className="text-foreground/45">u/{voice.author}</span>
        {voice.isSubmitter && (
          <span className="text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            OP
          </span>
        )}
        <span className="text-foreground/35 ml-auto">
          {formatRelative(voice.createdUtc * 1000)}
        </span>
      </div>

      <blockquote className="text-[15px] leading-relaxed text-foreground/85 border-l-2 border-orange-400/50 pl-3 italic">
        “{truncated}”
      </blockquote>

      <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-xs">
        <IconMessages className="w-3.5 h-3.5 text-foreground/35 shrink-0" />
        {voice.postFlair && <FlairPill voice={voice} />}
        <span className="text-foreground/55 truncate group-hover:text-foreground transition-colors">
          {voice.postTitle}
        </span>
      </div>
    </a>
  );
}

function FlairPill({ voice }: { voice: RedditVoice }) {
  const bg = voice.postFlairBg;
  const isLight = voice.postFlairTextColor === 'light';
  if (bg) {
    return (
      <span
        className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0"
        style={{ backgroundColor: bg, color: isLight ? '#fff' : '#1a1a1a' }}
      >
        {voice.postFlair}
      </span>
    );
  }
  return (
    <span className="inline-block bg-foreground/5 text-foreground/60 rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0">
      {voice.postFlair}
    </span>
  );
}
