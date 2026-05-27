import React from 'react';
import type { WeatherAlert } from '@/lib/fetchers/alerts';

const ALERT_STYLES = {
  red: {
    container: 'bg-red-500/15 border-red-500/60 dark:bg-red-500/20 dark:border-red-500/50',
    badge: 'bg-red-500 text-white',
    title: 'text-red-700 dark:text-red-200',
    meta: 'text-red-700 dark:text-red-300',
  },
  amber: {
    container: 'bg-amber-500/15 border-amber-500/60 dark:bg-amber-500/15 dark:border-amber-500/50',
    badge: 'bg-amber-500 text-white',
    title: 'text-amber-800 dark:text-amber-200',
    meta: 'text-amber-800 dark:text-amber-300',
  },
  blue: {
    container: 'bg-blue-500/10 border-blue-500/40 dark:bg-blue-500/15 dark:border-blue-500/40',
    badge: 'bg-blue-500 text-white',
    title: 'text-blue-800 dark:text-blue-200',
    meta: 'text-blue-800 dark:text-blue-300',
  },
} as const;

const SEVERITY_LABEL: Record<WeatherAlert['severity'], string> = {
  warning: 'WARNING',
  watch: 'WATCH',
  advisory: 'ADVISORY',
  statement: 'STATEMENT',
  unknown: 'ALERT',
};

function boldNumbers(text: string): React.ReactNode[] {
  return text.split(/(\d+(?:\.\d+)?)/).map((part, i) =>
    /^\d+(?:\.\d+)?$/.test(part) ? <strong key={i} className="font-bold">{part}</strong> : part
  );
}

export default function AlertsBlock({ alerts }: { alerts: WeatherAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      {alerts.map((a) => {
        const styles = ALERT_STYLES[a.color];
        return (
          <a
            key={a.title + a.issuedAt}
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`group block rounded-xl border-2 p-3 transition-all hover:shadow-lg ${styles.container}`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span aria-hidden className="text-xl leading-none">⚠️</span>
              <span className={`text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded ${styles.badge}`}>
                {SEVERITY_LABEL[a.severity]}
              </span>
              <h3 className={`text-base sm:text-lg font-bold leading-tight ${styles.title}`}>
                {a.title}
              </h3>
            </div>
            <p className={`text-xs mt-1 ${styles.meta}`}>{a.affectedArea}</p>
            <p className={`text-sm mt-0.5 ${styles.meta} flex flex-wrap gap-x-2 gap-y-0.5`}>
              <span>Impact: <strong className="font-semibold">{a.impact}</strong></span>
              <span aria-hidden>·</span>
              <span>Confidence: <strong className="font-semibold">{a.confidence}</strong></span>
              {a.issuedText && (
                <>
                  <span aria-hidden>·</span>
                  <span className={`font-semibold ${styles.title}`}>
                    Issued {boldNumbers(a.issuedText)}
                  </span>
                </>
              )}
            </p>
            {a.description && (
              <p className={`text-sm mt-2 whitespace-pre-line leading-snug ${styles.title}`}>
                {boldNumbers(a.description)}
              </p>
            )}
            <p className={`text-[11px] mt-2 ${styles.meta}`}>
              Source: Environment Canada
              <span aria-hidden className="inline-block ml-1 transition-transform group-hover:translate-x-0.5">↗</span>
            </p>
          </a>
        );
      })}
    </div>
  );
}
