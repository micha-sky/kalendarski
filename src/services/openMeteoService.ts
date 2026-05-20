import { format, eachDayOfInterval } from 'date-fns';
import type { Location, DayCacheEntry } from '../types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL  = 'https://archive-api.open-meteo.com/v1/archive';

// Open-Meteo returns 92 days of past data from the forecast endpoint.
// Older dates must use the archive endpoint.
const FORECAST_PAST_DAY_LIMIT = 92;

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    cloud_cover: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

function parseResponse(data: OpenMeteoResponse, today: string): Record<string, DayCacheEntry> {
  const now = Date.now();

  // Build sunrise/sunset map keyed by date string
  const sunMap = new Map<string, { sunriseHour: number; sunsetHour: number }>();
  if (data.daily) {
    data.daily.time.forEach((dateStr, i) => {
      sunMap.set(dateStr, {
        sunriseHour: new Date(data.daily.sunrise[i]).getHours(),
        sunsetHour:  new Date(data.daily.sunset[i]).getHours(),
      });
    });
  }

  // Bucket hourly readings by date
  const byDate = new Map<string, { temps: (number | null)[]; clouds: (number | null)[] }>();
  data.hourly.time.forEach((timeStr, i) => {
    const [dateStr, hourPart] = timeStr.split('T');
    const hour = parseInt(hourPart.split(':')[0], 10);
    if (!byDate.has(dateStr)) {
      byDate.set(dateStr, {
        temps:  new Array(24).fill(null),
        clouds: new Array(24).fill(null),
      });
    }
    const bucket = byDate.get(dateStr)!;
    bucket.temps[hour]  = data.hourly.temperature_2m[i] ?? null;
    bucket.clouds[hour] = data.hourly.cloud_cover[i]   ?? null;
  });

  const result: Record<string, DayCacheEntry> = {};
  for (const [dateStr, { temps, clouds }] of byDate) {
    const sun = sunMap.get(dateStr);
    result[dateStr] = {
      hourlyTemps:  temps,
      cloudCover:   clouds,
      sunriseHour:  sun?.sunriseHour ?? 6,
      sunsetHour:   sun?.sunsetHour  ?? 20,
      fetchedAt:    now,
      isHistorical: dateStr < today,
    };
  }
  return result;
}

async function fetchForecast(
  location: Location,
  startDate: Date,
  endDate: Date,
  todayMidnight: Date,
): Promise<Record<string, DayCacheEntry>> {
  const pastDays = Math.max(
    0,
    Math.min(FORECAST_PAST_DAY_LIMIT, Math.ceil((todayMidnight.getTime() - startDate.getTime()) / 86_400_000)),
  );
  const forecastDays = Math.max(
    1,
    Math.min(16, Math.ceil((endDate.getTime() - todayMidnight.getTime()) / 86_400_000) + 1),
  );

  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude',     location.latitude.toString());
  url.searchParams.set('longitude',    location.longitude.toString());
  url.searchParams.set('hourly',       'temperature_2m,cloud_cover');
  url.searchParams.set('daily',        'sunrise,sunset');
  url.searchParams.set('timezone',     'auto');
  url.searchParams.set('past_days',    pastDays.toString());
  url.searchParams.set('forecast_days', forecastDays.toString());

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Open-Meteo forecast ${response.status}`);
  return parseResponse(await response.json(), format(todayMidnight, 'yyyy-MM-dd'));
}

async function fetchArchive(
  location: Location,
  startDate: Date,
  endDate: Date,
  today: string,
): Promise<Record<string, DayCacheEntry>> {
  const url = new URL(ARCHIVE_URL);
  url.searchParams.set('latitude',   location.latitude.toString());
  url.searchParams.set('longitude',  location.longitude.toString());
  url.searchParams.set('start_date', format(startDate, 'yyyy-MM-dd'));
  url.searchParams.set('end_date',   format(endDate,   'yyyy-MM-dd'));
  url.searchParams.set('hourly',     'temperature_2m,cloud_cover');
  url.searchParams.set('daily',      'sunrise,sunset');
  url.searchParams.set('timezone',   'auto');

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Open-Meteo archive ${response.status}`);
  return parseResponse(await response.json(), today);
}

/**
 * Fetches hourly weather for every day in [startDate, endDate].
 * Uses the forecast endpoint (supports past_days up to 92) for recent dates,
 * and the archive endpoint for older dates.
 * Returns a record keyed by 'yyyy-MM-dd'.
 */
export async function fetchWeatherForRange(
  location: Location,
  startDate: Date,
  endDate: Date,
): Promise<Record<string, DayCacheEntry>> {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const todayStr = format(todayMidnight, 'yyyy-MM-dd');

  const archiveCutoff = new Date(todayMidnight);
  archiveCutoff.setDate(archiveCutoff.getDate() - FORECAST_PAST_DAY_LIMIT);

  // Cap future end at 16 days
  const maxFuture = new Date(todayMidnight);
  maxFuture.setDate(maxFuture.getDate() + 15);
  const clampedEnd = endDate > maxFuture ? maxFuture : endDate;

  const result: Record<string, DayCacheEntry> = {};

  if (startDate < archiveCutoff) {
    // Some dates are older than 92 days — need the archive endpoint
    const archiveEnd = clampedEnd < archiveCutoff
      ? clampedEnd
      : new Date(archiveCutoff.getTime() - 86_400_000);

    const archiveData = await fetchArchive(location, startDate, archiveEnd, todayStr);
    Object.assign(result, archiveData);

    // If the range also covers recent dates, fetch those from forecast endpoint
    if (clampedEnd >= archiveCutoff) {
      const forecastData = await fetchForecast(location, archiveCutoff, clampedEnd, todayMidnight);
      Object.assign(result, forecastData);
    }
  } else {
    // Entirely within 92-day window — single forecast call
    const forecastData = await fetchForecast(location, startDate, clampedEnd, todayMidnight);
    Object.assign(result, forecastData);
  }

  return result;
}

/**
 * Returns the subset of dates (as 'yyyy-MM-dd' strings) that are missing or stale
 * in the provided cache. Historical entries never expire; today expires after 30 min;
 * future dates expire after 3 hours.
 */
export function getMissingDates(
  startDate: Date,
  endDate: Date,
  cache: Record<string, DayCacheEntry>,
): string[] {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const now = Date.now();

  return eachDayOfInterval({ start: startDate, end: endDate })
    .map(d => format(d, 'yyyy-MM-dd'))
    .filter(dateStr => {
      const entry = cache[dateStr];
      if (!entry) return true;
      if (entry.isHistorical) return false;                         // historical: never refetch
      if (dateStr === todayStr) return now - entry.fetchedAt > 30 * 60_000;  // today: 30 min TTL
      return now - entry.fetchedAt > 3 * 60 * 60_000;              // future: 3 hr TTL
    });
}
