import { format } from 'date-fns';
import { describeWeatherCode } from './weatherCodes';

// Weather for a single event: the forecast at the event's own location and hour,
// distinct from the app's ambient day-gradient (which uses the home location).
// Open-Meteo serves ~92 days of past and ~16 days of future; outside that window
// there is no point forecast to show.

export interface EventWeather {
  temperature: number;               // °C
  precipitationProbability: number | null; // 0–100
  description: string;
  emoji: string;
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const PAST_LIMIT_DAYS = 92;
const FUTURE_LIMIT_DAYS = 15;

interface PointResponse {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability?: (number | null)[];
    is_day?: number[];
  };
}

/** Days between two dates at local midnight (b - a), positive if b is later. */
function dayOffset(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** True when a point forecast is available for this date (within Open-Meteo's window). */
export function hasEventForecast(when: Date): boolean {
  const offset = dayOffset(new Date(), when);
  return offset >= -PAST_LIMIT_DAYS && offset <= FUTURE_LIMIT_DAYS;
}

// Cache point forecasts so reopening the same event doesn't refetch. Keyed by
// rounded coords + date; entries live for 30 minutes.
const cache = new Map<string, { value: EventWeather | null; at: number }>();
const CACHE_TTL = 30 * 60_000;

/**
 * Fetch the forecast for a specific location and time. Returns null when the
 * date is outside the forecast window or the request fails (caller shows nothing).
 * For all-day events, uses the midday reading as representative.
 */
export async function getEventWeather(
  latitude: number,
  longitude: number,
  when: Date,
  allDay: boolean,
): Promise<EventWeather | null> {
  if (!hasEventForecast(when)) return null;

  const dateStr = format(when, 'yyyy-MM-dd');
  const hour = allDay ? 12 : when.getHours();
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)},${dateStr},${hour}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value;

  const url = new URL(FORECAST_URL);
  url.searchParams.set('latitude', latitude.toString());
  url.searchParams.set('longitude', longitude.toString());
  url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability,is_day');
  url.searchParams.set('start_date', dateStr);
  url.searchParams.set('end_date', dateStr);
  url.searchParams.set('timezone', 'auto');

  let value: EventWeather | null = null;
  try {
    const response = await fetch(url.toString());
    if (response.ok) {
      const data: PointResponse = await response.json();
      const h = data.hourly;
      if (h && h.time.length > 0) {
        // Find the requested hour; fall back to the first available reading.
        const idx = h.time.findIndex((t) => t.startsWith(`${dateStr}T`) && new Date(t).getHours() === hour);
        const i = idx >= 0 ? idx : 0;
        const info = describeWeatherCode(h.weather_code[i], (h.is_day?.[i] ?? 1) === 1);
        value = {
          temperature: h.temperature_2m[i],
          precipitationProbability: h.precipitation_probability?.[i] ?? null,
          description: info.description,
          emoji: info.emoji,
        };
      }
    }
  } catch {
    value = null;
  }

  cache.set(key, { value, at: Date.now() });
  return value;
}
