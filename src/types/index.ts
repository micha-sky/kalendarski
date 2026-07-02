// Calendar and Event Types
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  calendarId: string;
  color?: string;
  location?: string;
  attendees?: string[];
  recurrence?: RecurrenceRule;
  createdAt: Date;
  updatedAt: Date;
}

export interface Calendar {
  id: string;
  name: string;
  color: string;
  description?: string;
  isVisible: boolean;
  isReadOnly: boolean;
  type: 'personal' | 'subscribed' | 'caldav';
  url?: string; // For subscribed calendars
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  count?: number;
  byWeekDay?: number[];
  byMonthDay?: number[];
}

// Weather Types
export interface WeatherData {
  timestamp: number;
  temperature: number; // in Celsius
  feelsLike: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  cloudCover: number;
  visibility: number;
  uvIndex: number;
  condition: WeatherCondition;
  icon: string;
}

export interface WeatherCondition {
  main: string;
  description: string;
  id: number;
}

export interface WeatherForecast {
  current: WeatherData;
  hourly: WeatherData[];
  daily: DailyWeatherData[];
  location: Location;
  timezone: string;
  lastUpdated: Date;
}

export interface DailyWeatherData extends Omit<WeatherData, 'timestamp'> {
  date: string;
  sunrise: number;
  sunset: number;
  moonPhase: number;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbability: number;
  precipitationAmount: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  timezone?: string;
}

// UI Types
export interface CalendarViewType {
  type: 'month' | 'week' | 'day' | 'agenda';
  label: string;
}

export interface CalendarViewState {
  currentDate: Date;
  viewType: CalendarViewType['type'];
  selectedDate?: Date;
  selectedEvent?: CalendarEvent;
}

// Weather Heatmap Types
export interface HeatmapColor {
  temperature: number;
  color: string;
  opacity: number;
}

export interface WeatherHeatmapData {
  hour: number;
  temperature: number;
  color: string;
  opacity: number;
  isNight: boolean;
}

// API Response Types for OpenWeatherMap Free Tier
export interface OpenWeatherMapCurrentResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type: number;
    id: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

export interface OpenWeatherMapForecastResponse {
  cod: string;
  message: number;
  cnt: number;
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      sea_level: number;
      grnd_level: number;
      humidity: number;
      temp_kf: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    clouds: {
      all: number;
    };
    wind: {
      speed: number;
      deg: number;
      gust?: number;
    };
    visibility: number;
    pop: number;
    rain?: {
      '3h': number;
    };
    snow?: {
      '3h': number;
    };
    sys: {
      pod: string;
    };
    dt_txt: string;
  }>;
  city: {
    id: number;
    name: string;
    coord: {
      lat: number;
      lon: number;
    };
    country: string;
    population: number;
    timezone: number;
    sunrise: number;
    sunset: number;
  };
}

// Per-day hourly weather cache (keyed by 'yyyy-MM-dd')
export interface DayCacheEntry {
  hourlyTemps: (number | null)[];              // 24 values, index = hour
  cloudCover: (number | null)[];               // 24 values
  precipitationProbability?: (number | null)[]; // 24 values, 0-100; forecast only
  sunriseHour: number;
  sunsetHour: number;
  fetchedAt: number;               // Date.now()
  isHistorical: boolean;           // past dates never expire
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}
