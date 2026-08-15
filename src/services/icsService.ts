import ICAL from 'ical.js';
import type { CalendarEvent, EventSource, RecurrenceRule } from '../types';

/**
 * iCalendar (.ics) import/export.
 *
 * Recurrence is the classic trap — RRULE expansion, EXDATE, RECURRENCE-ID
 * overrides, timezone-aware DTSTART, and all-day vs timed events. We lean on
 * ical.js (a tested implementation) rather than hand-rolling any of it, and
 * expand recurring events into concrete occurrences within a bounded window so
 * the rest of the app can keep treating every event as a single instance.
 */

export interface ParseICSOptions {
  /** Calendar the imported events are attached to. */
  calendarId: string;
  /** Only expand occurrences within [rangeStart, rangeEnd]. */
  rangeStart: Date;
  rangeEnd: Date;
  /** Safety cap on occurrences emitted per recurring event. */
  maxOccurrencesPerEvent?: number;
  /** Colour to tag imported events with. */
  color?: string;
  /** Provenance to stamp on emitted events. Defaults to 'ics' (file import). */
  source?: EventSource;
}

const DEFAULT_MAX_OCCURRENCES = 750;
// Hard ceiling on iterator steps so a pathological RRULE can't spin forever.
const ITERATION_GUARD = 10_000;

function occurrenceId(uid: string, recurrenceUnix: number): string {
  return `ics:${uid}:${recurrenceUnix}`;
}

function toEvent(
  id: string,
  item: ICAL.Event,
  start: ICAL.Time,
  end: ICAL.Time,
  opts: ParseICSOptions,
): CalendarEvent {
  const now = new Date();
  return {
    id,
    title: item.summary || '(untitled)',
    description: item.description || undefined,
    start: start.toJSDate(),
    end: end.toJSDate(),
    // A DATE (no time component) value is an all-day event.
    allDay: start.isDate,
    calendarId: opts.calendarId,
    color: opts.color,
    location: item.location || undefined,
    source: opts.source ?? 'ics',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Parse an .ics document into normalised CalendarEvents, expanding recurring
 * events into individual occurrences within the requested window. Honours
 * EXDATE (deleted instances) and RECURRENCE-ID (modified instances), and keeps
 * wall-clock times correct across DST transitions.
 */
export function parseICSToEvents(icsText: string, opts: ParseICSOptions): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(icsText));
  const vevents = root.getAllSubcomponents('vevent');

  // Split masters from RECURRENCE-ID exception instances.
  const masters: ICAL.Component[] = [];
  const exceptions: ICAL.Component[] = [];
  for (const ve of vevents) {
    (ve.hasProperty('recurrence-id') ? exceptions : masters).push(ve);
  }

  const max = opts.maxOccurrencesPerEvent ?? DEFAULT_MAX_OCCURRENCES;
  const events: CalendarEvent[] = [];

  for (const ve of masters) {
    const event = new ICAL.Event(ve);

    // Attach any modified-instance overrides that share this UID.
    for (const ex of exceptions) {
      if (ex.getFirstPropertyValue('uid') === event.uid) {
        event.relateException(new ICAL.Event(ex));
      }
    }

    if (!event.isRecurring()) {
      const start = event.startDate;
      const end = event.endDate;
      if (start.toJSDate() <= opts.rangeEnd && end.toJSDate() >= opts.rangeStart) {
        events.push(toEvent(`ics:${event.uid}`, event, start, end, opts));
      }
      continue;
    }

    const iterator = event.iterator();
    let next: ICAL.Time | null;
    let emitted = 0;
    let steps = 0;
    while ((next = iterator.next())) {
      if (++steps > ITERATION_GUARD) break;
      const startJs = next.toJSDate();
      if (startJs > opts.rangeEnd) break;      // occurrences are chronological
      if (startJs < opts.rangeStart) continue; // before the window — skip
      const details = event.getOccurrenceDetails(next);
      events.push(
        toEvent(
          occurrenceId(event.uid, details.recurrenceId.toUnixTime()),
          details.item,
          details.startDate,
          details.endDate,
          opts,
        ),
      );
      if (++emitted >= max) break;
    }
  }

  return events;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// All-day events serialise as a floating DATE (YYYYMMDD), not an instant.
function toICALDate(d: Date): ICAL.Time {
  return ICAL.Time.fromData({
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    isDate: true,
  });
}

// RFC 5545 weekday names, indexed by the JS weekday numbering we store.
const ICAL_WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Build an RRULE for a locally created series. Only covers the subset of rules
 * the app can author (see RecurrenceRule) — imported events are expanded on
 * read and exported as individual occurrences, so they never reach this path.
 */
function toRRule(rule: RecurrenceRule): string {
  const parts = [`FREQ=${rule.frequency.toUpperCase()}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.frequency === 'weekly' && rule.byWeekDay?.length) {
    parts.push(`BYDAY=${rule.byWeekDay.map((d) => ICAL_WEEKDAYS[d]).join(',')}`);
  }
  if (rule.count != null) {
    parts.push(`COUNT=${rule.count}`);
  } else if (rule.endDate) {
    // UNTIL must be UTC when DTSTART is a timestamp.
    parts.push(`UNTIL=${ICAL.Time.fromJSDate(new Date(rule.endDate), true).toICALString()}`);
  }
  return parts.join(';');
}

/**
 * Serialise events to an .ics document. Timed events are written in UTC (Z) so
 * they are unambiguous; all-day events are written as DATE values. A recurring
 * event is written once, as a master carrying RRULE/EXDATE, rather than as its
 * expanded occurrences.
 */
export function eventsToICS(events: CalendarEvent[], calendarName = 'Kalendarski'): string {
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('prodid', '-//Kalendarski//Calendar//EN');
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('calscale', 'GREGORIAN');
  cal.updatePropertyWithValue('x-wr-calname', calendarName);

  const stamp = ICAL.Time.fromJSDate(new Date(), true);

  for (const e of events) {
    const vevent = new ICAL.Component('vevent');
    const event = new ICAL.Event(vevent);
    event.uid = e.id;
    event.summary = e.title;
    if (e.description) event.description = e.description;
    if (e.location) event.location = e.location;

    if (e.allDay) {
      event.startDate = toICALDate(e.start);
      // DTEND for a DATE value is exclusive; add a day so a single all-day
      // event spans exactly that day.
      const endExclusive = new Date(e.end);
      endExclusive.setDate(endExclusive.getDate() + 1);
      event.endDate = toICALDate(endExclusive);
    } else {
      event.startDate = ICAL.Time.fromJSDate(e.start, true);
      event.endDate = ICAL.Time.fromJSDate(e.end, true);
    }

    if (e.recurrence && e.recurrence.interval >= 1) {
      vevent.updatePropertyWithValue('rrule', ICAL.Recur.fromString(toRRule(e.recurrence)));
      for (const ex of e.recurrence.exDates ?? []) {
        vevent.addPropertyWithValue(
          'exdate',
          e.allDay ? toICALDate(new Date(ex)) : ICAL.Time.fromJSDate(new Date(ex), true),
        );
      }
    }

    vevent.updatePropertyWithValue('dtstamp', stamp);
    cal.addSubcomponent(vevent);
  }

  return cal.toString();
}

/** Filename-safe timestamp like 2026-08-08. */
export function icsExportFilename(prefix = 'kalendarski'): string {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.ics`;
}
