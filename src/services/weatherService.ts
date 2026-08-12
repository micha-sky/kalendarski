import type {WeatherForecast, WeatherData, Location} from '../types';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

interface OpenMeteoCurrentResponse {
  timezone: string;
  utc_offset_seconds: number;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    cloud_cover: number;
    weather_code: number;
    is_day: number;
  };
}

interface ConditionInfo {
  main: string;
  description: string;
  emoji: string;
}

/**
 * Maps a WMO weather code (used by Open-Meteo) to a human-readable condition
 * and an emoji icon. `isDay` swaps sun/moon glyphs for clear-ish skies.
 * Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes).
 */
function describeWeatherCode(code: number, isDay: boolean): ConditionInfo {
  switch (code) {
    case 0:
      return { main: 'Clear', description: 'clear sky', emoji: isDay ? '☀️' : '🌙' };
    case 1:
      return { main: 'Clear', description: 'mainly clear', emoji: isDay ? '🌤️' : '🌙' };
    case 2:
      return { main: 'Clouds', description: 'partly cloudy', emoji: isDay ? '⛅' : '☁️' };
    case 3:
      return { main: 'Clouds', description: 'overcast', emoji: '☁️' };
    case 45:
    case 48:
      return { main: 'Fog', description: 'fog', emoji: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { main: 'Drizzle', description: 'drizzle', emoji: '🌦️' };
    case 56:
    case 57:
      return { main: 'Drizzle', description: 'freezing drizzle', emoji: '🌧️' };
    case 61:
    case 63:
    case 65:
      return { main: 'Rain', description: 'rain', emoji: '🌧️' };
    case 66:
    case 67:
      return { main: 'Rain', description: 'freezing rain', emoji: '🌧️' };
    case 71:
    case 73:
    case 75:
      return { main: 'Snow', description: 'snow', emoji: '🌨️' };
    case 77:
      return { main: 'Snow', description: 'snow grains', emoji: '🌨️' };
    case 80:
    case 81:
    case 82:
      return { main: 'Rain', description: 'rain showers', emoji: '🌦️' };
    case 85:
    case 86:
      return { main: 'Snow', description: 'snow showers', emoji: '🌨️' };
    case 95:
      return { main: 'Thunderstorm', description: 'thunderstorm', emoji: '⛈️' };
    case 96:
    case 99:
      return { main: 'Thunderstorm', description: 'thunderstorm with hail', emoji: '⛈️' };
    default:
      return { main: 'Unknown', description: 'unknown conditions', emoji: '🌡️' };
  }
}

/**
 * Fetches current conditions from Open-Meteo (no API key required).
 * Only the `current` block of WeatherForecast is consumed by the UI (header
 * conditions + Calendar tint); the day-by-day gradient is served separately by
 * openMeteoService.fetchWeatherForRange.
 */
export async function fetchWeatherData(location: Location): Promise<WeatherForecast> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', location.latitude.toString());
  url.searchParams.set('longitude', location.longitude.toString());
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code,is_day',
  );
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Weather rate limit exceeded. Please try again later.');
    }
    throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
  }

  const data: OpenMeteoCurrentResponse = await response.json();
  const c = data.current;
  const condition = describeWeatherCode(c.weather_code, c.is_day === 1);

  const current: WeatherData = {
    timestamp: Math.floor(new Date(c.time).getTime() / 1000),
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    pressure: c.surface_pressure,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    cloudCover: c.cloud_cover,
    visibility: 0,
    uvIndex: 0,
    condition: {
      main: condition.main,
      description: condition.description,
      id: c.weather_code,
    },
    icon: condition.emoji,
  };

  const offsetHours = data.utc_offset_seconds / 3600;
  return {
    current,
    hourly: [],
    daily: [],
    location,
    timezone: `UTC${offsetHours >= 0 ? '+' : ''}${offsetHours}`,
    lastUpdated: new Date(),
  };
}

/**
 * Gets the user's current location using the Geolocation API
 */
export function getCurrentLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    const tryGetPosition = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          // kCLErrorLocationUnknown maps to POSITION_UNAVAILABLE — retry with low accuracy
          if (error.code === error.POSITION_UNAVAILABLE && highAccuracy) {
            tryGetPosition(false);
            return;
          }

          let message = 'Failed to get your location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location access denied. Please enable location services.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out.';
              break;
          }
          reject(new Error(message));
        },
        { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 300000 },
      );
    };

    tryGetPosition(true);
  });
}

interface BigDataCloudReverseResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryCode?: string;
}

/**
 * Reverse geocoding to get city and country from coordinates using
 * BigDataCloud's keyless client-side endpoint (no API key required).
 */
export async function reverseGeocode(location: Location): Promise<Location> {
  const url = new URL(REVERSE_GEOCODE_URL);
  url.searchParams.set('latitude', location.latitude.toString());
  url.searchParams.set('longitude', location.longitude.toString());
  url.searchParams.set('localityLanguage', 'en');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      // Return location without city/country if geocoding fails
      return location;
    }

    const data: BigDataCloudReverseResponse = await response.json();
    const city = data.city || data.locality || data.principalSubdivision;
    if (!city) return location;

    return {
      ...location,
      city,
      country: data.countryCode,
    };
  } catch {
    // Return location without city/country if geocoding fails
    return location;
  }
}

/**
 * Cache management for weather data
 */
const CACHE_KEY = 'kalendarski_weather_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

interface WeatherCache {
  data: WeatherForecast;
  timestamp: number;
  location: Location;
}

/**
 * Gets cached weather data if available and not expired
 */
export function getCachedWeatherData(location: Location): WeatherForecast | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData: WeatherCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - cacheData.timestamp > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Check if location matches (within 0.01 degrees)
    const latDiff = Math.abs(cacheData.location.latitude - location.latitude);
    const lonDiff = Math.abs(cacheData.location.longitude - location.longitude);

    if (latDiff > 0.01 || lonDiff > 0.01) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cacheData.data;
  } catch {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Caches weather data
 */
export function cacheWeatherData(data: WeatherForecast, location: Location): void {
  try {
    const cacheData: WeatherCache = {
      data,
      timestamp: Date.now(),
      location,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    // Ignore cache errors
    console.warn('Failed to cache weather data:', error);
  }
}

/**
 * Main function to get weather data with caching
 */
export async function getWeatherData(location?: Location): Promise<WeatherForecast> {
  let targetLocation = location;

  // Get current location if not provided
  if (!targetLocation) {
    targetLocation = await getCurrentLocation();
    targetLocation = await reverseGeocode(targetLocation);
  }

  // Try to get cached data first
  const cachedData = getCachedWeatherData(targetLocation);
  if (cachedData) {
    return cachedData;
  }

  // Fetch fresh data
  const weatherData = await fetchWeatherData(targetLocation);

  // Cache the data
  cacheWeatherData(weatherData, targetLocation);

  return weatherData;
}
