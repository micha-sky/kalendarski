import type { Location, DayCacheEntry } from '../types';
import { fetchWeatherForRange } from './openMeteoService';

/**
 * Provider-agnostic weather layer.
 *
 * The app must never call a concrete provider (Open-Meteo, a paid API, …)
 * directly — it goes through the `activeProvider` below. Swapping providers is
 * a one-line change here; nothing in the UI or state layer needs to know which
 * service is in use, because every provider returns the same normalised shape
 * (`DayCacheEntry` per day, keyed by 'yyyy-MM-dd').
 */

/**
 * How many days ahead a deterministic forecast is meaningful. Open-Meteo's
 * standard forecast endpoint tops out at 16 days; beyond this the app shows
 * nothing rather than presenting a number that implies false certainty.
 */
export const FORECAST_HORIZON_DAYS = 16;

export interface ProviderAttribution {
  name: string;
  url: string;
}

export interface WeatherProvider {
  /** Stable identifier, e.g. 'open-meteo'. */
  readonly id: string;
  /** Human-visible credit required by the provider's licence. */
  readonly attribution: ProviderAttribution;
  /**
   * Normalised hourly weather for every day in [startDate, endDate],
   * keyed by 'yyyy-MM-dd'. Historical and forecast dates are both supported;
   * the provider decides how to source each.
   */
  getForecast(
    location: Location,
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, DayCacheEntry>>;
}

// Rounding coordinates to ~2 decimals (~1.1km) keeps repeated lookups for the
// same place identical, so the provider/CDN can serve them from cache and tiny
// GPS jitter doesn't produce a fresh request every time.
function roundCoords(location: Location): Location {
  return {
    ...location,
    latitude: Math.round(location.latitude * 100) / 100,
    longitude: Math.round(location.longitude * 100) / 100,
  };
}

export const openMeteoProvider: WeatherProvider = {
  id: 'open-meteo',
  attribution: { name: 'Open-Meteo', url: 'https://open-meteo.com/' },
  getForecast(location, startDate, endDate) {
    return fetchWeatherForRange(roundCoords(location), startDate, endDate);
  },
};

/**
 * The provider the app uses. To move to a paid/commercial provider later,
 * implement `WeatherProvider` against it and change only this binding.
 */
export const activeProvider: WeatherProvider = openMeteoProvider;
