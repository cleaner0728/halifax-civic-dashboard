import EndOfDashboardFooter from '@/components/EndOfDashboardFooter';
import EventsFeed from '@/components/EventsFeed';
import type { HalifaxEvent } from '@/lib/fetchers/events';

type Props = { renderedAt: number; events: HalifaxEvent[] };

export default function EventsCalendarScreen({ renderedAt, events }: Props) {
  return (
    <div className="pt-14 md:pt-24 pb-24 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-2">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700 dark:from-violet-900 dark:via-purple-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Events</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">What&apos;s On</h2>
              <p className="text-base text-white/70 mt-1">
                Upcoming events · Halifax, NS
              </p>
            </div>
            <div className="text-5xl">🎟️</div>
          </div>
        </div>

        <EventsFeed events={events} />

        <EndOfDashboardFooter renderedAt={renderedAt} />
      </div>
    </div>
  );
}
