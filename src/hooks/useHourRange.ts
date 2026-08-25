// Which hours the day/week timelines render.
//
// Rendering all 24 hours spends more than a quarter of the grid on hours nobody
// has events in, and — because the heatmap darkens at night — that quarter is
// also the least legible part of the screen. 'daylight' trims it to the hours
// that day's sun is actually up.
//
// The trim is never allowed to hide an event: the range is widened to cover any
// event on the visible days. A 23:00 dinner brings the late rows back, which is
// the correct outcome even though it costs some of the saving.

import { useCallback, useState } from 'react';
import { isSameDay } from 'date-fns';
import type { CalendarEvent, DayCacheEntry } from '../types';
import { daylightHourRange } from '../services/dayWeatherSummary';

export type HourRangeMode = 'daylight' | 'full';

const STORAGE_KEY = 'kalendarski_hour_range';

function loadMode(): HourRangeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'daylight' || stored === 'full') return stored;
  } catch { /* ignore */ }
  return 'daylight';
}

/** The mode, persisted so the choice survives a reload like the location does. */
export function useHourRangeMode(): [HourRangeMode, (mode: HourRangeMode) => void] {
  const [mode, setModeState] = useState<HourRangeMode>(loadMode);

  const setMode = useCallback((next: HourRangeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch { /* ignore quota errors */ }
  }, []);

  return [mode, setMode];
}

const ALL_HOURS = Array.from({ length: 24 }, (_, h) => h);

/**
 * The ascending, contiguous list of hours to render.
 *
 * `dayKeys` must line up with `days` (same order); it is passed in rather than
 * derived so the caller can reuse its own already-formatted keys.
 */
export function computeVisibleHours(
  mode: HourRangeMode,
  days: Date[],
  dayKeys: string[],
  cache: Record<string, DayCacheEntry> | undefined,
  events: CalendarEvent[],
): number[] {
  if (mode === 'full') return ALL_HOURS;

  const { startHour, endHour } = daylightHourRange(dayKeys.map(key => cache?.[key]));

  let start = startHour;
  let end = endHour;

  // Widen to cover every timed event on the visible days, so trimming the grid
  // can never make an event disappear.
  for (const event of events) {
    if (event.allDay) continue;
    if (!days.some(day => isSameDay(event.start, day) || isSameDay(event.end, day))) continue;
    start = Math.min(start, event.start.getHours());
    // An event ending at 18:00 occupies the 17:00 row, not the 18:00 one.
    const lastHour = event.end.getHours() - (event.end.getMinutes() === 0 ? 1 : 0);
    end = Math.max(end, Math.min(23, Math.max(lastHour, event.start.getHours())));
  }

  start = Math.max(0, start);
  end = Math.min(23, end);
  if (end < start) return ALL_HOURS;

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
