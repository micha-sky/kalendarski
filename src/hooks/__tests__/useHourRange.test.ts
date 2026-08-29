// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { CalendarEvent, DayCacheEntry } from '../../types';
import { computeVisibleHours } from '../useHourRange';

const DAY = new Date(2026, 7, 25); // Tue 25 Aug 2026, local
const DAY_KEY = '2026-08-25';

function cacheEntry(sunriseHour: number, sunsetHour: number): DayCacheEntry {
  return {
    hourlyTemps: new Array(24).fill(null),
    cloudCover: new Array(24).fill(null),
    sunriseHour,
    sunsetHour,
    fetchedAt: Date.now(),
    isHistorical: false,
  };
}

function event(startHour: number, endHour: number, endMinutes = 0): CalendarEvent {
  const start = new Date(DAY);
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(DAY);
  end.setHours(endHour, endMinutes, 0, 0);
  return {
    id: `e-${startHour}-${endHour}`,
    title: 'Test',
    start,
    end,
    allDay: false,
    calendarId: 'default',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const cache = { [DAY_KEY]: cacheEntry(6, 20) };

describe('computeVisibleHours', () => {
  it('returns all 24 hours in full mode regardless of daylight', () => {
    const result = computeVisibleHours('full', [DAY], [DAY_KEY], cache, []);
    expect(result).toHaveLength(24);
    expect(result[0]).toBe(0);
    expect(result[23]).toBe(23);
  });

  it('trims to padded daylight in daylight mode', () => {
    // sunrise 6, sunset 20, padded by one either side.
    expect(computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, []))
      .toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  });

  it('is contiguous and ascending', () => {
    const result = computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, []);
    result.forEach((hour, i) => {
      if (i > 0) expect(hour).toBe(result[i - 1] + 1);
    });
  });

  it('widens to cover an event that starts before dawn', () => {
    const result = computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, [event(3, 4)]);
    expect(result[0]).toBe(3);
    expect(result[result.length - 1]).toBe(21);
  });

  it('widens to cover an event that runs past the trimmed end', () => {
    const result = computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, [event(22, 23)]);
    expect(result[result.length - 1]).toBe(22);
  });

  it('does not add a row for an event ending exactly on the hour', () => {
    // 21:00–22:00 occupies the 21:00 row only; 22:00 must stay hidden.
    const result = computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, [event(21, 22)]);
    expect(result[result.length - 1]).toBe(21);
  });

  it('does add a row for an event spilling past the hour', () => {
    // 21:00–22:30 reaches into the 22:00 row.
    const result = computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, [event(21, 22, 30)]);
    expect(result[result.length - 1]).toBe(22);
  });

  it('ignores all-day events, which never occupy an hour row', () => {
    const allDay: CalendarEvent = { ...event(0, 23), allDay: true };
    expect(computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, [allDay]))
      .toEqual(computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, []));
  });

  it('ignores events on days outside the visible range', () => {
    const other = event(2, 3);
    other.start = new Date(2026, 7, 1, 2, 0, 0, 0);
    other.end = new Date(2026, 7, 1, 3, 0, 0, 0);
    expect(computeVisibleHours('daylight', [DAY], [DAY_KEY], cache, [other])[0]).toBe(5);
  });

  it('spans the union of daylight across several days', () => {
    const days = [DAY, new Date(2026, 7, 26)];
    const keys = [DAY_KEY, '2026-08-26'];
    const twoDay = {
      [DAY_KEY]: cacheEntry(8, 16),
      '2026-08-26': cacheEntry(5, 21),
    };
    const result = computeVisibleHours('daylight', days, keys, twoDay, []);
    expect(result[0]).toBe(4);
    expect(result[result.length - 1]).toBe(22);
  });

  it('falls back to a waking-hours window when nothing is cached', () => {
    expect(computeVisibleHours('daylight', [DAY], [DAY_KEY], {}, [])[0]).toBe(7);
  });
});
