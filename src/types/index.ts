// Where an event came from. All sources map into the same CalendarEvent shape
// so the UI never branches on provider. Absent = treat as a local event.
export type EventSource = 'local' | 'ics' | 'subscription';

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
  /** Resolved coordinates for `location`, enabling per-event weather. Optional:
   *  free-text locations (or ICS imports) may have no coordinates. */
  locationCoords?: { latitude: number; longitude: number; timezone?: string };
  attendees?: string[];
  /** Present on the stored master event of a series. Occurrences are derived
   *  from it on read (see recurrenceService), never persisted. */
  recurrence?: RecurrenceRule;
  /** Set only on a generated occurrence, pointing back at its master's id.
   *  Absent on stored events. */
  seriesId?: string;
  source?: EventSource;
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
  /** Repeat every N units of `frequency`. Must be >= 1. */
  interval: number;
  /** Last date an occurrence may start on. Mutually exclusive with `count`. */
  endDate?: Date;
  /** Total number of occurrences the rule generates. Excluded dates still
   *  consume one, per RFC 5545. Mutually exclusive with `endDate`. */
  count?: number;
  /** Weekly rules only: days to repeat on, JS convention (0 = Sunday). */
  byWeekDay?: number[];
  byMonthDay?: number[];
  /** Start instants of occurrences the user deleted individually (EXDATE). */
  exDates?: Date[];
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
