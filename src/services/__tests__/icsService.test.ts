// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseICSToEvents, eventsToICS } from '../icsService';
import type { CalendarEvent } from '../../types';

// A real America/New_York VTIMEZONE so ical.js can resolve DST correctly.
const NY_VTIMEZONE = `BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:20070311T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:20071104T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE`;

function ics(...vevents: string[]): string {
  return `BEGIN:VCALENDAR
PRODID:-//Test//EN
VERSION:2.0
${NY_VTIMEZONE}
${vevents.join('\n')}
END:VCALENDAR`;
}

const RANGE = { rangeStart: new Date('2026-01-01'), rangeEnd: new Date('2026-12-31') };
const OPTS = { calendarId: 'test', ...RANGE };

// Format a Date's wall-clock in a specific timezone, tz-independent of the host.
function hourIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false }).format(date);
}

describe('parseICSToEvents — recurrence', () => {
  it('keeps wall-clock time across a DST boundary for a weekly event', () => {
    // Fri 09:00 NY, weekly. 2026-03-06 is EST(-5); DST starts 2026-03-08, so
    // 2026-03-13 onward is EDT(-4). Every occurrence must still read 09:00 NY.
    const doc = ics(
      `BEGIN:VEVENT
UID:dst-weekly@test
DTSTART;TZID=America/New_York:20260306T090000
DTEND;TZID=America/New_York:20260306T100000
RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=4
SUMMARY:Standup
END:VEVENT`,
    );

    const events = parseICSToEvents(doc, OPTS);
    expect(events).toHaveLength(4); // 3/6, 3/13, 3/20, 3/27

    for (const e of events) {
      expect(hourIn(e.start, 'America/New_York')).toBe('09');
    }

    // The pre-DST and post-DST occurrences are a real hour apart in UTC.
    const preDst = events[0].start.getTime();  // 2026-03-06 (EST)
    const postDst = events[1].start.getTime(); // 2026-03-13 (EDT)
    const sevenDaysMs = 7 * 24 * 3600 * 1000;
    expect(postDst - preDst).toBe(sevenDaysMs - 3600 * 1000);
  });

  it('keeps an all-day event on the correct date in a non-UTC timezone', () => {
    // Guards against parsing a DATE value as UTC midnight and shifting a day
    // when the host is in a negative-offset zone (the suite runs under TZ=PT).
    const doc = ics(
      `BEGIN:VEVENT
UID:allday@test
DTSTART;VALUE=DATE:20260315
DTEND;VALUE=DATE:20260316
SUMMARY:Holiday
END:VEVENT`,
    );

    const events = parseICSToEvents(doc, OPTS);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.allDay).toBe(true);
    // Local date must be the 15th, not the 14th or 16th.
    expect(e.start.getFullYear()).toBe(2026);
    expect(e.start.getMonth()).toBe(2); // March (0-indexed)
    expect(e.start.getDate()).toBe(15);
  });

  it('omits a deleted instance (EXDATE) without dropping or duplicating others', () => {
    const doc = ics(
      `BEGIN:VEVENT
UID:exdate@test
DTSTART;TZID=America/New_York:20260306T090000
DTEND;TZID=America/New_York:20260306T100000
RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=4
EXDATE;TZID=America/New_York:20260313T090000
SUMMARY:Standup
END:VEVENT`,
    );

    const events = parseICSToEvents(doc, OPTS);
    expect(events).toHaveLength(3); // 3/13 removed

    // None fall on the excluded date...
    const onMar13 = events.filter((e) => e.start.getMonth() === 2 && e.start.getDate() === 13);
    expect(onMar13).toHaveLength(0);
    // ...and every occurrence is unique.
    const ids = new Set(events.map((e) => e.id));
    expect(ids.size).toBe(events.length);
  });

  it('applies a RECURRENCE-ID override to a single occurrence', () => {
    const doc = ics(
      `BEGIN:VEVENT
UID:override@test
DTSTART;TZID=America/New_York:20260306T090000
DTEND;TZID=America/New_York:20260306T100000
RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=3
SUMMARY:Standup
END:VEVENT`,
      `BEGIN:VEVENT
UID:override@test
RECURRENCE-ID;TZID=America/New_York:20260313T090000
DTSTART;TZID=America/New_York:20260313T140000
DTEND;TZID=America/New_York:20260313T150000
SUMMARY:Standup (moved)
END:VEVENT`,
    );

    const events = parseICSToEvents(doc, OPTS).sort((a, b) => +a.start - +b.start);
    expect(events).toHaveLength(3);
    const moved = events[1];
    expect(moved.title).toBe('Standup (moved)');
    expect(hourIn(moved.start, 'America/New_York')).toBe('14');
  });
});

describe('eventsToICS — export round-trip', () => {
  it('round-trips a timed event and an all-day event', () => {
    const original: CalendarEvent[] = [
      {
        id: 'evt-timed',
        title: 'Meeting',
        description: 'Sync',
        start: new Date('2026-05-01T15:00:00Z'),
        end: new Date('2026-05-01T16:00:00Z'),
        allDay: false,
        calendarId: 'default',
        location: 'Room 1',
        source: 'local',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'evt-allday',
        title: 'Conference',
        start: new Date(2026, 5, 10), // 2026-06-10 local
        end: new Date(2026, 5, 10),
        allDay: true,
        calendarId: 'default',
        source: 'local',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const doc = eventsToICS(original);
    const parsed = parseICSToEvents(doc, {
      calendarId: 'imported',
      rangeStart: new Date('2026-01-01'),
      rangeEnd: new Date('2026-12-31'),
    }).sort((a, b) => a.title.localeCompare(b.title));

    expect(parsed).toHaveLength(2);

    const conference = parsed.find((e) => e.title === 'Conference')!;
    expect(conference.allDay).toBe(true);
    expect(conference.start.getFullYear()).toBe(2026);
    expect(conference.start.getMonth()).toBe(5);
    expect(conference.start.getDate()).toBe(10);

    const meeting = parsed.find((e) => e.title === 'Meeting')!;
    expect(meeting.allDay).toBe(false);
    expect(meeting.start.toISOString()).toBe('2026-05-01T15:00:00.000Z');
    expect(meeting.location).toBe('Room 1');
  });
});
