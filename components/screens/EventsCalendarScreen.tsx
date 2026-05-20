// Static screen — just embeds the HRM Google Calendar aggregator iframe.

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

export default function EventsCalendarScreen() {
  return (
    <div data-screen-scroll className="pt-[140px] pb-8 h-screen overflow-y-auto bg-gradient-to-b from-background to-background">
      <div className="max-w-5xl mx-auto px-2 mt-4">
        <p className="text-xl font-semibold text-center text-foreground mb-3">
          📅 Upcoming civic events · Halifax, NS
        </p>

        <div className="rounded-xl overflow-hidden border border-border shadow-sm bg-white p-2 mb-4">
          <iframe
            src={CALENDAR_SRC}
            style={{ border: 0 }}
            width="100%"
            height="467"
            title="Halifax Events Calendar"
          />
        </div>
        <p className="text-sm text-foreground/50 text-center">
          Data sourced from{' '}
          <a
            href="https://www.halifax.ca/home/events-calendar"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-500 hover:underline"
          >
            HRM Events Calendar
          </a>
        </p>
      </div>
    </div>
  );
}
