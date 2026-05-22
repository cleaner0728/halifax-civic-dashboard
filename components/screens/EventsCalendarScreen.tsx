// Static screen — embeds the HRM Google Calendar aggregator iframe, with the
// Emera Oval live webcam below it.

import EmeraOvalWebcam from '@/components/EmeraOvalWebcam';
import EndOfDashboardFooter from '@/components/EndOfDashboardFooter';

const CALENDAR_SRC =
  'https://calendar.google.com/calendar/embed?showTitle=0&mode=AGENDA&height=600&wkst=1&bgcolor=%23FFFFFF' +
  '&src=dd2f3gg1q7g2sodi34c479jqmk%40group.calendar.google.com&color=%232952A3' +
  '&src=ipkj749g67h89epofrv9p0u6d0%40group.calendar.google.com&color=%23691426' +
  '&src=p5ej79pes2tvh726nm9nq9hq18%40group.calendar.google.com&color=%23B1440E' +
  '&src=rl70382c737j9hs58vpba93gh8%40group.calendar.google.com&color=%235F6B02' +
  '&src=hrmevents%40gmail.com&color=%238D6F47' +
  '&src=app6upa4ffc9pb8abkachap288%40group.calendar.google.com&color=%23182C57' +
  '&src=7lkspm0u8ku7oe5htfdi71sklg%40group.calendar.google.com&color=%2323164E' +
  '&src=1vqddsm57v05s6t0s14vbugjqc%40group.calendar.google.com&color=%238D6F47' +
  '&src=37870qc8aqd9mavck2b84rc7a4%40group.calendar.google.com&color=%23865A5A' +
  '&src=recvanproject%40gmail.com&color=%231B887A' +
  '&src=dajspdtgg3uhbo6hdjl1ekjbeg%40group.calendar.google.com&color=%2328754E' +
  '&src=g3bfd4h4ngthv403cn2i0lktdc%40group.calendar.google.com&color=%232952A3' +
  '&src=tatije54pe1od7h44434muu06s%40group.calendar.google.com&color=%23875509' +
  '&src=78k92dn8i5h4hkghv11bsmlqgo%40group.calendar.google.com&color=%23AB8B00' +
  '&src=qd2crcgvujt5jcock6aivr7he4%40group.calendar.google.com&color=%23853104' +
  '&src=2568t0odfpavvip1tnqq4mhvpo%40group.calendar.google.com&color=%23691426' +
  '&ctz=America%2FHalifax';

export default function EventsCalendarScreen({ renderedAt }: { renderedAt: number }) {
  return (
    <div className="pt-20 pb-4 min-h-dvh">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700 dark:from-violet-900 dark:via-purple-900 dark:to-slate-900 text-white shadow-xl mb-6 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white/70 uppercase tracking-widest">Events</p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">Civic Calendar</h2>
              <p className="text-base text-white/70 mt-1">
                Upcoming events · Halifax, NS ·{' '}
                <a
                  href="https://www.halifax.ca/home/events-calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-white"
                >
                  halifax.ca/events
                </a>
              </p>
            </div>
            <div className="text-5xl">🎟️</div>
          </div>
        </div>

        <div className="rounded-xl overflow-hidden border border-border shadow-sm bg-white p-2 mb-4">
          <iframe
            src={CALENDAR_SRC}
            style={{ border: 0 }}
            width="100%"
            height="311"
            title="Halifax Events Calendar"
          />
        </div>

        <EmeraOvalWebcam />

        <EndOfDashboardFooter renderedAt={renderedAt} />
      </div>
    </div>
  );
}
