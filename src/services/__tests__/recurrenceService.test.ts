// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  expandRecurringEvent,
  expandEvents,
  occurrenceId,
  seriesIdOf,
  isOccurrenceId,
  describeRecurrence,
} from '../recurrenceService';
import type { CalendarEvent, RecurrenceRule } from '../../types';

// These tests assume TZ=America/Los_Angeles so the DST cases are meaningful.
// Run: TZ=America/Los_Angeles npx vitest run src/services/__tests__/recurrenceService.test.ts

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const now = new Date('2026-01-01T00:00:00Z');
  return {
    id: 'evt-1',
    title: 'Standup',
    start: new Date(2026, 0, 5, 9, 0), // Mon 5 Jan 2026, 09:00 local
    end: new Date(2026, 0, 5, 9, 30),
    allDay: false,
    calendarId: 'cal-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const WIDE = {
  rangeStart: new Date(2020, 0, 1),
  rangeEnd: new Date(2030, 0, 1),
};

function starts(events: CalendarEvent[]): string[] {
  return events.map((e) => {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${e.start.getFullYear()}-${p(e.start.getMonth() + 1)}-${p(e.start.getDate())} ${p(e.start.getHours())}:${p(e.start.getMinutes())}`;
  });
}

describe('expandRecurringEvent', () => {
  it('passes a non-recurring event through unchanged when it overlaps the window', () => {
    const event = makeEvent();
    const out = expandRecurringEvent(event, WIDE);
    expect(out).toEqual([event]);
    expect(out[0]).toBe(event); // identity preserved, not a copy
  });

  it('drops a non-recurring event outside the window', () => {
    const event = makeEvent();
    const out = expandRecurringEvent(event, {
      rangeStart: new Date(2027, 0, 1),
      rangeEnd: new Date(2027, 1, 1),
    });
    expect(out).toEqual([]);
  });

  it('expands a daily rule with a count', () => {
    const event = makeEvent({ recurrence: { frequency: 'daily', interval: 1, count: 3 } });
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-01-05 09:00',
      '2026-01-06 09:00',
      '2026-01-07 09:00',
    ]);
  });

  it('honours an interval greater than one', () => {
    const event = makeEvent({ recurrence: { frequency: 'daily', interval: 3, count: 3 } });
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-01-05 09:00',
      '2026-01-08 09:00',
      '2026-01-11 09:00',
    ]);
  });

  it('stops at endDate', () => {
    const event = makeEvent({
      recurrence: { frequency: 'daily', interval: 1, endDate: new Date(2026, 0, 7, 23, 59) },
    });
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-01-05 09:00',
      '2026-01-06 09:00',
      '2026-01-07 09:00',
    ]);
  });

  it('expands weekly on specific weekdays, in chronological order', () => {
    // Mon/Wed/Fri, starting Mon 5 Jan 2026.
    const event = makeEvent({
      recurrence: { frequency: 'weekly', interval: 1, byWeekDay: [1, 3, 5], count: 5 },
    });
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-01-05 09:00', // Mon
      '2026-01-07 09:00', // Wed
      '2026-01-09 09:00', // Fri
      '2026-01-12 09:00', // Mon
      '2026-01-14 09:00', // Wed
    ]);
  });

  it('does not emit weekdays that precede DTSTART in the first week', () => {
    // Series starts Wednesday but repeats Mon/Wed — the first Monday is skipped.
    const event = makeEvent({
      start: new Date(2026, 0, 7, 9, 0), // Wed
      end: new Date(2026, 0, 7, 9, 30),
      recurrence: { frequency: 'weekly', interval: 1, byWeekDay: [1, 3], count: 3 },
    });
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-01-07 09:00', // Wed
      '2026-01-12 09:00', // Mon
      '2026-01-14 09:00', // Wed
    ]);
  });

  it('handles a byWeekDay set spanning the Sunday wrap', () => {
    // Sun + Mon: Monday-relative ordering must put Mon before Sun within a week.
    const event = makeEvent({
      start: new Date(2026, 0, 5, 9, 0), // Mon
      end: new Date(2026, 0, 5, 9, 30),
      recurrence: { frequency: 'weekly', interval: 1, byWeekDay: [0, 1], count: 4 },
    });
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-01-05 09:00', // Mon
      '2026-01-11 09:00', // Sun
      '2026-01-12 09:00', // Mon
      '2026-01-18 09:00', // Sun
    ]);
  });

  it('skips months that lack the start day rather than clamping', () => {
    // 31 Jan monthly: Feb/Apr/Jun have no 31st and must be skipped, not moved
    // to the 28th/30th.
    const event = makeEvent({
      start: new Date(2026, 0, 31, 9, 0),
      end: new Date(2026, 0, 31, 10, 0),
      recurrence: { frequency: 'monthly', interval: 1 },
    });
    const out = starts(
      expandRecurringEvent(event, { rangeStart: new Date(2026, 0, 1), rangeEnd: new Date(2026, 6, 1) }),
    );
    expect(out).toEqual([
      '2026-01-31 09:00',
      '2026-03-31 09:00',
      '2026-05-31 09:00',
    ]);
  });

  it('does not let a clamped month drag the rest of the series backwards', () => {
    // Stepping from the original start (not iteratively) keeps the 31st.
    const event = makeEvent({
      start: new Date(2026, 0, 31, 9, 0),
      end: new Date(2026, 0, 31, 10, 0),
      recurrence: { frequency: 'monthly', interval: 1 },
    });
    const out = starts(
      expandRecurringEvent(event, { rangeStart: new Date(2026, 11, 1), rangeEnd: new Date(2027, 1, 1) }),
    );
    expect(out).toEqual(['2026-12-31 09:00', '2027-01-31 09:00']);
  });

  it('keeps wall-clock time across a spring-forward DST boundary', () => {
    // US DST begins Sun 8 Mar 2026. A 09:00 daily event stays at 09:00 local.
    const event = makeEvent({
      start: new Date(2026, 2, 6, 9, 0),
      end: new Date(2026, 2, 6, 9, 30),
      recurrence: { frequency: 'daily', interval: 1, count: 4 },
    });
    const out = expandRecurringEvent(event, WIDE);
    expect(starts(out)).toEqual([
      '2026-03-06 09:00',
      '2026-03-07 09:00',
      '2026-03-08 09:00',
      '2026-03-09 09:00',
    ]);
    // Duration is preserved even though the day itself is 23 hours long.
    for (const occ of out) {
      expect(occ.end.getTime() - occ.start.getTime()).toBe(30 * 60 * 1000);
    }
  });

  it('keeps wall-clock time across a fall-back DST boundary', () => {
    // US DST ends Sun 1 Nov 2026.
    const event = makeEvent({
      start: new Date(2026, 9, 30, 9, 0),
      end: new Date(2026, 9, 30, 9, 30),
      recurrence: { frequency: 'daily', interval: 1, count: 4 },
    });
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-10-30 09:00',
      '2026-10-31 09:00',
      '2026-11-01 09:00',
      '2026-11-02 09:00',
    ]);
  });

  it('omits excluded dates but still counts them against COUNT', () => {
    const event = makeEvent({
      recurrence: {
        frequency: 'daily',
        interval: 1,
        count: 3,
        exDates: [new Date(2026, 0, 6, 9, 0)],
      },
    });
    // 3 generated, middle one excluded -> 2 emitted (not backfilled to 3).
    expect(starts(expandRecurringEvent(event, WIDE))).toEqual([
      '2026-01-05 09:00',
      '2026-01-07 09:00',
    ]);
  });

  it('only emits occurrences overlapping the window', () => {
    const event = makeEvent({ recurrence: { frequency: 'daily', interval: 1, count: 100 } });
    expect(starts(expandRecurringEvent(event, {
      rangeStart: new Date(2026, 0, 10),
      rangeEnd: new Date(2026, 0, 12, 23, 59),
    }))).toEqual([
      '2026-01-10 09:00',
      '2026-01-11 09:00',
      '2026-01-12 09:00',
    ]);
  });

  it('includes an occurrence that started before the window but overlaps into it', () => {
    // 23:00 -> 01:00 the next day; the window opens after it starts.
    const event = makeEvent({
      start: new Date(2026, 0, 5, 23, 0),
      end: new Date(2026, 0, 6, 1, 0),
      recurrence: { frequency: 'daily', interval: 1, count: 5 },
    });
    const out = expandRecurringEvent(event, {
      rangeStart: new Date(2026, 0, 7, 0, 30),
      rangeEnd: new Date(2026, 0, 7, 2, 0),
    });
    expect(starts(out)).toEqual(['2026-01-06 23:00']);
  });

  it('caps runaway series at maxOccurrences', () => {
    const event = makeEvent({ recurrence: { frequency: 'daily', interval: 1 } });
    const out = expandRecurringEvent(event, { ...WIDE, maxOccurrences: 10 });
    expect(out).toHaveLength(10);
  });

  it('terminates on an unbounded daily rule over a wide window', () => {
    // No count, no endDate, ten-year window: must be bounded by the safety cap
    // rather than running away.
    const event = makeEvent({ recurrence: { frequency: 'daily', interval: 1 } });
    const out = expandRecurringEvent(event, WIDE);
    expect(out).toHaveLength(750);
  });

  it('treats an invalid interval as non-recurring rather than looping forever', () => {
    const event = makeEvent({ recurrence: { frequency: 'daily', interval: 0 } });
    expect(expandRecurringEvent(event, WIDE)).toEqual([event]);
  });

  it('gives occurrences stable ids that carry the series id', () => {
    const event = makeEvent({ recurrence: { frequency: 'daily', interval: 1, count: 2 } });
    const [first, second] = expandRecurringEvent(event, WIDE);

    expect(first.id).not.toBe(second.id);
    expect(seriesIdOf(first.id)).toBe('evt-1');
    expect(first.seriesId).toBe('evt-1');
    expect(isOccurrenceId(first.id)).toBe(true);

    // Re-expanding yields identical ids.
    const again = expandRecurringEvent(event, WIDE);
    expect(again.map((e) => e.id)).toEqual([first.id, second.id]);
  });

  it('carries master fields onto every occurrence', () => {
    const event = makeEvent({
      color: '#ff0000',
      location: 'Barcelona',
      locationCoords: { latitude: 41.39, longitude: 2.16, timezone: 'Europe/Madrid' },
      recurrence: { frequency: 'daily', interval: 1, count: 2 },
    });
    for (const occ of expandRecurringEvent(event, WIDE)) {
      expect(occ.color).toBe('#ff0000');
      expect(occ.location).toBe('Barcelona');
      expect(occ.locationCoords?.timezone).toBe('Europe/Madrid');
      expect(occ.title).toBe('Standup');
    }
  });
});

describe('seriesIdOf / isOccurrenceId', () => {
  it('returns a plain id unchanged', () => {
    expect(seriesIdOf('evt-1')).toBe('evt-1');
    expect(isOccurrenceId('evt-1')).toBe(false);
  });

  it('round-trips an occurrence id', () => {
    const id = occurrenceId('evt-1', 1767639600000);
    expect(seriesIdOf(id)).toBe('evt-1');
  });

  it('survives an id that itself contains colons', () => {
    // Imported events use ids like "ics:uid:12345".
    const id = occurrenceId('ics:abc:1', 1767639600000);
    expect(seriesIdOf(id)).toBe('ics:abc:1');
  });
});

describe('expandEvents', () => {
  it('expands recurring events and passes plain ones through', () => {
    const plain = makeEvent({ id: 'plain', start: new Date(2026, 0, 6, 12, 0), end: new Date(2026, 0, 6, 13, 0) });
    const series = makeEvent({ id: 'series', recurrence: { frequency: 'daily', interval: 1, count: 2 } });

    const out = expandEvents([plain, series], WIDE);
    expect(out).toHaveLength(3);
    expect(out.filter((e) => e.seriesId === 'series')).toHaveLength(2);
    expect(out.filter((e) => e.id === 'plain')).toHaveLength(1);
  });

  it('returns an empty list for no events', () => {
    expect(expandEvents([], WIDE)).toEqual([]);
  });
});

describe('describeRecurrence', () => {
  const cases: Array<[RecurrenceRule, string]> = [
    [{ frequency: 'daily', interval: 1 }, 'Every day'],
    [{ frequency: 'weekly', interval: 2 }, 'Every 2 weeks'],
    [{ frequency: 'monthly', interval: 1 }, 'Every month'],
    [{ frequency: 'weekly', interval: 1, byWeekDay: [1, 3, 5] }, 'Every week on Mon, Wed, Fri'],
    [{ frequency: 'weekly', interval: 1, byWeekDay: [0, 1] }, 'Every week on Mon, Sun'],
    [{ frequency: 'daily', interval: 1, count: 5 }, 'Every day, 5 times'],
  ];

  it.each(cases)('describes %j', (rule, expected) => {
    expect(describeRecurrence(rule)).toBe(expected);
  });
});
