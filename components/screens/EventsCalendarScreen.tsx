import EndOfDashboardFooter from '@/components/EndOfDashboardFooter';
import EventsFeed from '@/components/EventsFeed';
import { IconTicket } from '@/components/icons';
import type { HalifaxEvent } from '@/lib/fetchers/events';

type Props = { renderedAt: number; events: HalifaxEvent[] };

export default function EventsCalendarScreen({ renderedAt, events }: Props) {
  return (
    <div className="pt-14 md:pt-24 pb-24 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-2">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 mb-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-widest">Events</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground mt-0.5">What&apos;s On</h2>
            <p className="text-sm text-foreground/50 mt-0.5">
              Upcoming events · Halifax, NS
            </p>
          </div>
          <IconTicket className="w-7 h-7 text-foreground/30 shrink-0" />
        </div>

        <EventsFeed events={events} />

        <EndOfDashboardFooter renderedAt={renderedAt} />
      </div>
    </div>
  );
}
