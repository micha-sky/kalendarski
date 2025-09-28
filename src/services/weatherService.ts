import type {WeatherForecast, WeatherData, DailyWeatherData, Location, OpenWeatherMapCurrentResponse, OpenWeatherMapForecastResponse} from '../types';

// You'll need to get your API key from https://openweathermap.org/api
const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || 'your-api-key-here';
const OPENWEATHER_CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather';
const OPENWEATHER_FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

/**
 * Transforms OpenWeatherMap free tier API responses to our internal format
 */
function transformWeatherData(
  currentResponse: OpenWeatherMapCurrentResponse,
  forecastResponse: OpenWeatherMapForecastResponse,
  location: Location
): WeatherForecast {
  // Transform current weather
  const current: WeatherData = {
    timestamp: currentResponse.dt,
    temperature: currentResponse.main.temp,
    feelsLike: currentResponse.main.feels_like,
    humidity: currentResponse.main.humidity,
    pressure: currentResponse.main.pressure,
    windSpeed: currentResponse.wind.speed,
    windDirection: currentResponse.wind.deg,
    cloudCover: currentResponse.clouds.all,
    visibility: currentResponse.visibility,
    uvIndex: 0, // Not available in free tier
    condition: {
      main: currentResponse.weather[0].main,
      description: currentResponse.weather[0].description,
      id: currentResponse.weather[0].id,
    },
    icon: currentResponse.weather[0].icon,
  };

  // Transform hourly data from 5-day forecast (every 3 hours)
  const hourly: WeatherData[] = forecastResponse.list.slice(0, 16).map((item) => ({
    timestamp: item.dt,
    temperature: item.main.temp,
    feelsLike: item.main.feels_like,
    humidity: item.main.humidity,
    pressure: item.main.pressure,
    windSpeed: item.wind.speed,
    windDirection: item.wind.deg,
    cloudCover: item.clouds.all,
    visibility: item.visibility,
    uvIndex: 0, // Not available in free tier
    condition: {
      main: item.weather[0].main,
      description: item.weather[0].description,
      id: item.weather[0].id,
    },
    icon: item.weather[0].icon,
  }));

  // Transform daily data by grouping forecast items by date
  const dailyMap = new Map<string, any[]>();
  forecastResponse.list.forEach((item) => {
    const date = item.dt_txt.split(' ')[0];
    if (!dailyMap.has(date)) {
      dailyMap.set(date, []);
    }
    dailyMap.get(date)!.push(item);
  });

  const daily: DailyWeatherData[] = Array.from(dailyMap.entries()).slice(0, 5).map(([date, items]) => {
    const temps = items.map(item => item.main.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const avgTemp = temps.reduce((sum, temp) => sum + temp, 0) / temps.length;

    // Use the middle item of the day for representative data
    const representative = items[Math.floor(items.length / 2)];

    return {
      date,
      temperature: avgTemp,
      feelsLike: representative.main.feels_like,
      humidity: representative.main.humidity,
      pressure: representative.main.pressure,
      windSpeed: representative.wind.speed,
      windDirection: representative.wind.deg,
      cloudCover: representative.clouds.all,
      visibility: representative.visibility,
      uvIndex: 0, // Not available in free tier
      condition: {
        main: representative.weather[0].main,
        description: representative.weather[0].description,
        id: representative.weather[0].id,
      },
      icon: representative.weather[0].icon,
      sunrise: forecastResponse.city.sunrise,
      sunset: forecastResponse.city.sunset,
      moonPhase: 0, // Not available in free tier
      temperatureMin: minTemp,
      temperatureMax: maxTemp,
      precipitationProbability: representative.pop * 100,
      precipitationAmount: (representative.rain?.['3h'] || 0) + (representative.snow?.['3h'] || 0),
    };
  });

  return {
    current,
    hourly,
    daily,
    location,
    timezone: `UTC${forecastResponse.city.timezone >= 0 ? '+' : ''}${forecastResponse.city.timezone / 3600}`,
    lastUpdated: new Date(),
  };
}

/**
 * Fetches weather data from OpenWeatherMap free tier APIs
 */
export async function fetchWeatherData(location: Location): Promise<WeatherForecast> {
  if (!OPENWEATHER_API_KEY || OPENWEATHER_API_KEY === 'your-api-key-here') {
    throw new Error('OpenWeatherMap API key is not configured. Please set VITE_OPENWEATHER_API_KEY in your environment variables.');
  }

  try {
    // Fetch current weather
    const currentUrl = new URL(OPENWEATHER_CURRENT_URL);
    currentUrl.searchParams.set('lat', location.latitude.toString());
    currentUrl.searchParams.set('lon', location.longitude.toString());
    currentUrl.searchParams.set('appid', OPENWEATHER_API_KEY);
    currentUrl.searchParams.set('units', 'metric');

    // Fetch 5-day forecast
    const forecastUrl = new URL(OPENWEATHER_FORECAST_URL);
    forecastUrl.searchParams.set('lat', location.latitude.toString());
    forecastUrl.searchParams.set('lon', location.longitude.toString());
    forecastUrl.searchParams.set('appid', OPENWEATHER_API_KEY);
    forecastUrl.searchParams.set('units', 'metric');

    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(currentUrl.toString()),
      fetch(forecastUrl.toString())
    ]);

    if (!currentResponse.ok) {
      if (currentResponse.status === 401) {
        throw new Error('Invalid API key. Please check your OpenWeatherMap API key.');
      } else if (currentResponse.status === 429) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Weather API error: ${currentResponse.status} ${currentResponse.statusText}`);
      }
    }

    if (!forecastResponse.ok) {
      if (forecastResponse.status === 401) {
        throw new Error('Invalid API key. Please check your OpenWeatherMap API key.');
      } else if (forecastResponse.status === 429) {
        throw new Error('API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Forecast API error: ${forecastResponse.status} ${forecastResponse.statusText}`);
      }
    }

    const currentData: OpenWeatherMapCurrentResponse = await currentResponse.json();
    const forecastData: OpenWeatherMapForecastResponse = await forecastResponse.json();

    return transformWeatherData(currentData, forecastData, location);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch weather data. Please check your internet connection.');
  }
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

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
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
      options
    );
  });
}

/**
 * Reverse geocoding to get city and country from coordinates
 */
export async function reverseGeocode(location: Location): Promise<Location> {
  const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${location.latitude}&lon=${location.longitude}&limit=1&appid=${OPENWEATHER_API_KEY}`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      // Return location without city/country if geocoding fails
      return location;
    }
    
    const data = await response.json();
    
    if (data.length > 0) {
      return {
        ...location,
        city: data[0].name,
        country: data[0].country,
      };
    }
    
    return location;
  } catch (error) {
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
  } catch (error) {
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
