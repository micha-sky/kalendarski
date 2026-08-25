// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { DayCacheEntry } from '../../types';
import {
  summarizeDay,
  precipitationByHour,
  precipitationRuns,
  formatPrecipRun,
  daylightHourRange,
} from '../dayWeatherSummary';

/** Builds a cache entry, defaulting every hourly array to 24 nulls. */
function entry(overrides: Partial<DayCacheEntry> = {}): DayCacheEntry {
  return {
    hourlyTemps: new Array(24).fill(null),
    cloudCover: new Array(24).fill(null),
    sunriseHour: 6,
    sunsetHour: 20,
    fetchedAt: Date.now(),
    isHistorical: false,
    ...overrides,
  };
}

/** 24 hourly values from a sparse {hour: value} map. */
function hours(values: Record<number, number>): (number | null)[] {
  const out: (number | null)[] = new Array(24).fill(null);
  for (const [h, v] of Object.entries(values)) out[Number(h)] = v;
  return out;
}

describe('precipitationByHour', () => {
  it('uses measured amount, with 0.1mm as the floor for "it rains"', () => {
    const wet = precipitationByHour(entry({
      precipitationMm: hours({ 12: 0.05, 13: 0.1, 14: 2.4 }),
    }));
    expect(wet.has(12)).toBe(false); // trace, below the floor
    expect(wet.get(13)).toBe('rain');
    expect(wet.get(14)).toBe('rain');
  });

  it('falls back to probability only when amount is missing for that hour', () => {
    const wet = precipitationByHour(entry({
      precipitationMm: hours({ 10: 0 }),          // 10 has an amount: dry
      precipitationProbability: hours({ 10: 90, 11: 60, 12: 40 }),
    }));
    expect(wet.has(10)).toBe(false); // amount wins over the 90% probability
    expect(wet.get(11)).toBe('rain'); // no amount, 60% clears the bar
    expect(wet.has(12)).toBe(false);  // no amount, 40% does not
  });

  it('reads the WMO code to tell snow from rain', () => {
    const wet = precipitationByHour(entry({
      precipitationMm: hours({ 8: 1, 9: 1 }),
      weatherCode: hours({ 8: 73, 9: 63 }), // 73 = snow, 63 = rain
    }));
    expect(wet.get(8)).toBe('snow');
    expect(wet.get(9)).toBe('rain');
  });
});

describe('precipitationRuns', () => {
  it('merges contiguous wet hours into one run', () => {
    const runs = precipitationRuns(entry({
      precipitationMm: hours({ 14: 1, 15: 2, 16: 1 }),
    }));
    expect(runs).toEqual([{ startHour: 14, endHour: 16, kind: 'rain' }]);
  });

  it('splits on a dry hour', () => {
    const runs = precipitationRuns(entry({
      precipitationMm: hours({ 6: 1, 7: 1, 12: 1 }),
    }));
    expect(runs).toEqual([
      { startHour: 6, endHour: 7, kind: 'rain' },
      { startHour: 12, endHour: 12, kind: 'rain' },
    ]);
  });

  it('splits when precipitation changes kind mid-stretch', () => {
    const runs = precipitationRuns(entry({
      precipitationMm: hours({ 3: 1, 4: 1, 5: 1 }),
      weatherCode: hours({ 3: 63, 4: 63, 5: 73 }),
    }));
    expect(runs).toEqual([
      { startHour: 3, endHour: 4, kind: 'rain' },
      { startHour: 5, endHour: 5, kind: 'snow' },
    ]);
  });

  it('returns nothing for a dry day', () => {
    expect(precipitationRuns(entry({ precipitationMm: hours({ 12: 0 }) }))).toEqual([]);
  });
});

describe('formatPrecipRun', () => {
  it('reads as the clock span covered, so the end hour is exclusive', () => {
    expect(formatPrecipRun({ startHour: 14, endHour: 16, kind: 'rain' })).toBe('14–17');
  });

  it('renders a single wet hour as its own one-hour span', () => {
    expect(formatPrecipRun({ startHour: 15, endHour: 15, kind: 'rain' })).toBe('15–16');
  });

  it('wraps a run ending at 23:00 round to 00', () => {
    expect(formatPrecipRun({ startHour: 22, endHour: 23, kind: 'rain' })).toBe('22–00');
  });

  it('zero-pads morning hours', () => {
    expect(formatPrecipRun({ startHour: 5, endHour: 6, kind: 'snow' })).toBe('05–07');
  });
});

describe('summarizeDay', () => {
  it('takes the high and low from the whole day, not just daylight', () => {
    const summary = summarizeDay(entry({
      hourlyTemps: hours({ 3: 4, 9: 18, 15: 27, 22: 11 }),
    }));
    expect(summary).toMatchObject({ high: 27, low: 4 });
  });

  it('returns null when there are no temperatures at all', () => {
    expect(summarizeDay(entry())).toBeNull();
  });

  it('reports the peak probability alongside the concrete rain hours', () => {
    const summary = summarizeDay(entry({
      hourlyTemps: hours({ 12: 20 }),
      precipitationMm: hours({ 14: 1.2, 15: 0.9 }),
      precipitationProbability: hours({ 13: 30, 14: 80, 15: 70 }),
    }));
    expect(summary!.rainPercent).toBe(80);
    expect(summary!.precipRuns).toEqual([{ startHour: 14, endHour: 15, kind: 'rain' }]);
  });

  it('lets the longest run pick the day emoji, not the first', () => {
    const summary = summarizeDay(entry({
      hourlyTemps: hours({ 12: 20 }),
      // A one-hour snow flurry at 05:00, then five hours of rain.
      precipitationMm: hours({ 5: 1, 12: 1, 13: 1, 14: 1, 15: 1, 16: 1 }),
      weatherCode: hours({ 5: 73, 12: 63, 13: 63, 14: 63, 15: 63, 16: 63 }),
    }));
    expect(summary!.emoji).toBe('🌧️');
  });

  it('falls back to cloud cover on a dry day', () => {
    const summary = summarizeDay(entry({
      hourlyTemps: hours({ 12: 20 }),
      cloudCover: new Array(24).fill(5),
    }));
    expect(summary!.emoji).toBe('☀️');
  });
});

describe('daylightHourRange', () => {
  it('pads an hour either side of the sun so dawn and dusk are visible', () => {
    expect(daylightHourRange([entry({ sunriseHour: 6, sunsetHour: 20 })]))
      .toEqual({ startHour: 5, endHour: 21 });
  });

  it('spans the union across a week of differing days', () => {
    expect(daylightHourRange([
      entry({ sunriseHour: 8, sunsetHour: 16 }),
      entry({ sunriseHour: 6, sunsetHour: 19 }),
    ])).toEqual({ startHour: 5, endHour: 20 });
  });

  it('clamps the padding at midnight and 23:00', () => {
    expect(daylightHourRange([entry({ sunriseHour: 0, sunsetHour: 23 })]))
      .toEqual({ startHour: 0, endHour: 23 });
  });

  it('uses a plausible waking day when nothing is cached', () => {
    expect(daylightHourRange([undefined, undefined]))
      .toEqual({ startHour: 7, endHour: 21 });
  });
});
