import type { ReactNode } from "react";

type Props = {
  title: string;
  icon?: ReactNode;
  meta?: string;
  // Optional "drill in" affordance. When provided, a subtle button appears in
  // the header that jumps to the matching full detail section in the shell.
  onOpen?: () => void;
  openLabel?: string;
  className?: string;
  children: ReactNode;
};

// Presentational card used across the desktop Today board. No client-only
// behaviour of its own — it inherits the client bundle from DesktopShell, and
// is never imported into the mobile tree.
export default function WidgetCard({
  title,
  icon,
  meta,
  onOpen,
  openLabel = "Open",
  className = "",
  children,
}: Props) {
  return (
    <section
      className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-border/60">
        {icon && <span className="text-foreground/55 shrink-0">{icon}</span>}
        <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
          {title}
        </h3>
        {meta && (
          <span className="text-xs text-foreground/40 truncate">· {meta}</span>
        )}
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="ml-auto shrink-0 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
          >
            {openLabel} →
          </button>
        )}
      </header>
      <div className="px-4 py-3.5 flex-1 min-w-0">{children}</div>
    </section>
  );
}
