// Turns a raw DayCacheEntry into the numbers the calendar views actually show:
// the day's high and low, a condition emoji, and — the point of this module —
// *which hours* precipitation falls in, so a cell can say "🌧️ 14–17" instead of
// the much vaguer "40% chance today".
//
// Shared by every view (month cell, week header + grid, day grid, agenda) so
// they can never disagree about what the same day's weather was.

import type { DayCacheEntry } from '../types';
import { describeWeatherCode } from './weatherCodes';

/** Below this, an hour's precipitation is a trace that never reaches the ground
 *  in any way a person would call "rain". Open-Meteo reports in mm. */
const WET_HOUR_MM = 0.1;

/** Used only when precipitation amount is unavailable for the hour (a stale v1
 *  cache entry, or a provider that omits it). Probability alone never commits
 *  to an hour, so the bar is set high. */
const WET_HOUR_PROBABILITY = 50;

export type PrecipKind = 'rain' | 'snow';

export interface PrecipRun {
  /** First wet hour, 0-23. */
  startHour: number;
  /** Last wet hour, 0-23 (inclusive). */
  endHour: number;
  kind: PrecipKind;
}

export interface DaySummary {
  /** Warmest hourly temperature of the day, rounded. */
  high: number;
  /** Coldest hourly temperature of the day, rounded. */
  low: number;
  emoji: string;
  /** Highest hourly precipitation probability, rounded. 0 when unknown. */
  rainPercent: number;
  /** Contiguous stretches of wet hours, earliest first. Empty when dry. */
  precipRuns: PrecipRun[];
}

/** WMO codes that mean frozen precipitation. Everything else wet is 'rain'. */
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

function kindForCode(code: number | null | undefined): PrecipKind {
  return code != null && SNOW_CODES.has(code) ? 'snow' : 'rain';
}

/**
 * Which hours of the day have precipitation, and of what kind.
 * Prefers measured/forecast amount in mm; falls back to probability.
 */
export function precipitationByHour(entry: DayCacheEntry): Map<number, PrecipKind> {
  const wet = new Map<number, PrecipKind>();
  for (let hour = 0; hour < 24; hour++) {
    const mm = entry.precipitationMm?.[hour];
    const isWet = mm != null
      ? mm >= WET_HOUR_MM
      : (entry.precipitationProbability?.[hour] ?? 0) >= WET_HOUR_PROBABILITY;
    if (isWet) wet.set(hour, kindForCode(entry.weatherCode?.[hour]));
  }
  return wet;
}

/** Collapses wet hours into contiguous runs. A change of kind starts a new run. */
export function precipitationRuns(entry: DayCacheEntry): PrecipRun[] {
  const wet = precipitationByHour(entry);
  const runs: PrecipRun[] = [];
  let current: PrecipRun | null = null;

  for (let hour = 0; hour < 24; hour++) {
    const kind = wet.get(hour);
    if (kind == null) {
      current = null;
      continue;
    }
    if (current && current.endHour === hour - 1 && current.kind === kind) {
      current.endHour = hour;
    } else {
      current = { startHour: hour, endHour: hour, kind };
      runs.push(current);
    }
  }
  return runs;
}

/**
 * Formats a run as the clock span it covers. An hour bucket labelled 14:00
 * describes 14:00–15:00, so the end reads as `endHour + 1`: hours 14,15,16
 * become "14–17", and a lone hour 15 becomes "15–16".
 */
export function formatPrecipRun(run: PrecipRun): string {
  const pad = (h: number) => String(h % 24).padStart(2, '0');
  return `${pad(run.startHour)}–${pad(run.endHour + 1)}`;
}

export function precipRunEmoji(kind: PrecipKind): string {
  return kind === 'snow' ? '🌨️' : '🌧️';
}

/**
 * The day's headline weather. Returns null when the entry carries no usable
 * temperatures at all — callers render nothing rather than a fabricated 0°.
 */
export function summarizeDay(entry: DayCacheEntry): DaySummary | null {
  const temps = entry.hourlyTemps.filter((t): t is number => t != null);
  if (!temps.length) return null;

  const probabilities = (entry.precipitationProbability ?? []).filter(
    (p): p is number => p != null,
  );
  const precipRuns = precipitationRuns(entry);

  return {
    high: Math.round(Math.max(...temps)),
    low: Math.round(Math.min(...temps)),
    emoji: dayEmoji(entry, precipRuns),
    rainPercent: probabilities.length ? Math.round(Math.max(...probabilities)) : 0,
    precipRuns,
  };
}

/**
 * The single emoji that stands for the whole day. Precipitation wins if there
 * is any, since that is what changes plans; otherwise the daytime cloud cover
 * decides. Hourly weather codes are preferred when present because they already
 * encode the distinction; cloud percentage is the fallback.
 */
function dayEmoji(entry: DayCacheEntry, runs: PrecipRun[]): string {
  if (runs.length) {
    // Describe the longest run — a two-hour shower shouldn't outrank all-day rain.
    const longest = runs.reduce((a, b) =>
      b.endHour - b.startHour > a.endHour - a.startHour ? b : a,
    );
    const code = entry.weatherCode?.[longest.startHour];
    if (code != null) return describeWeatherCode(code, true).emoji;
    return precipRunEmoji(longest.kind);
  }

  const daytimeClouds: number[] = [];
  for (let h = entry.sunriseHour; h <= entry.sunsetHour; h++) {
    const c = entry.cloudCover[h];
    if (c != null) daytimeClouds.push(c);
  }
  if (!daytimeClouds.length) return '🌡️';

  const avg = daytimeClouds.reduce((a, b) => a + b, 0) / daytimeClouds.length;
  if (avg < 20) return '☀️';
  if (avg < 50) return '🌤️';
  if (avg < 75) return '⛅';
  return '☁️';
}

/**
 * The hour range worth rendering in the timeline views: daylight, padded by an
 * hour either side so dawn and dusk are visible rather than clipped.
 * Falls back to a plausible waking day when no weather is cached yet.
 */
export function daylightHourRange(entries: (DayCacheEntry | undefined)[]): {
  startHour: number;
  endHour: number;
} {
  let start = Infinity;
  let end = -Infinity;
  for (const entry of entries) {
    if (!entry) continue;
    start = Math.min(start, entry.sunriseHour);
    end = Math.max(end, entry.sunsetHour);
  }
  if (!isFinite(start) || !isFinite(end)) return { startHour: 7, endHour: 21 };
  return {
    startHour: Math.max(0, start - 1),
    endHour: Math.min(23, end + 1),
  };
}
